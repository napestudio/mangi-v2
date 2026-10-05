import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { isTimeGridAligned, isTimeWithinRange, isWrappedPortion, TableStatus } from "@mangiar/shared";
import type { PrismaClient, ReservationStatus as PrismaReservationStatus, TimeSlot as PrismaTimeSlot } from "../../../generated/prisma/client";
import { addDays, zonedNow, zonedTimeToUtcISO } from "../../common/time-window.util";
import { PrismaService } from "../../prisma/prisma.service";
import { TablesService } from "../salon/tables.service";
import { EventsGateway } from "../websockets/events.gateway";
import type { CheckAvailabilityDto } from "./dto/check-availability.dto";
import type { CreateReservationDto } from "./dto/create-reservation.dto";
import type { ListReservationsDto } from "./dto/list-reservations.dto";
import type { UpdateReservationDto } from "./dto/update-reservation.dto";
import type { UpdateReservationStatusDto } from "./dto/update-reservation-status.dto";

const RESERVATION_INCLUDE = { tables: { include: { table: true } }, timeSlot: true } as const;
const INACTIVE_STATUSES: PrismaReservationStatus[] = ["CANCELED", "NO_SHOW"];
const SEARCH_PADDING_MS = 24 * 60 * 60 * 1000;
const TABLE_CONFLICT_SEARCH_PADDING_MS = 7 * 24 * 60 * 60 * 1000;

type AvailabilityClient = Pick<PrismaClient, "reservation">;
type TableCheckClient = Pick<PrismaClient, "table">;
type ClientCheckClient = Pick<PrismaClient, "client">;

interface AvailabilityParams {
  date: Date;
  partySize: number;
  tableIds?: string[];
  excludeReservationId?: string;
}

export interface AvailabilityResult {
  available: boolean;
  reason: "CAPACITY" | "TABLE_CONFLICT" | null;
  remainingCapacity: number;
  conflictingTableId: string | null;
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly tablesService: TablesService,
  ) {}

  findAll(restaurantId: string, query: ListReservationsDto) {
    return this.prisma.reservation.findMany({
      where: {
        restaurantId,
        businessDate: {
          gte: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
          lte: query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined,
        },
      },
      include: RESERVATION_INCLUDE,
      orderBy: { date: "asc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({ where: { id, restaurantId }, include: RESERVATION_INCLUDE });
    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }
    return reservation;
  }

  async checkAvailability(restaurantId: string, dto: CheckAvailabilityDto): Promise<AvailabilityResult> {
    const { timeSlot, date } = await this.resolveRequest(restaurantId, dto.timeSlotId, dto.businessDate, dto.time);
    return this.evaluateAvailability(this.prisma, restaurantId, timeSlot, {
      date,
      partySize: dto.partySize,
      tableIds: dto.tableIds,
      excludeReservationId: dto.excludeReservationId,
    });
  }

  async create(restaurantId: string, dto: CreateReservationDto) {
    const { timeSlot, date } = await this.resolveRequest(restaurantId, dto.timeSlotId, dto.businessDate, dto.time);
    const lockKey = this.lockKey(dto.timeSlotId, dto.businessDate);

    const reservation = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const availability = await this.evaluateAvailability(tx, restaurantId, timeSlot, {
        date,
        partySize: dto.partySize,
        tableIds: dto.tableIds,
      });
      this.assertAvailable(availability);

      if (dto.tableIds?.length) {
        await this.requireTables(tx, restaurantId, dto.tableIds);
      }
      if (dto.clientId) {
        await this.requireClient(tx, restaurantId, dto.clientId);
      }

      return tx.reservation.create({
        data: {
          restaurantId,
          timeSlotId: dto.timeSlotId,
          date,
          businessDate: new Date(`${dto.businessDate}T00:00:00.000Z`),
          partySize: dto.partySize,
          guestName: dto.guestName,
          guestEmail: dto.guestEmail,
          guestPhone: dto.guestPhone,
          dietaryRestrictions: dto.dietaryRestrictions,
          accessibilityNeeds: dto.accessibilityNeeds,
          notes: dto.notes,
          clientId: dto.clientId,
          tables: dto.tableIds?.length ? { create: dto.tableIds.map((tableId) => ({ tableId })) } : undefined,
        },
        include: RESERVATION_INCLUDE,
      });
    });

    this.eventsGateway.emitReservationCreated(restaurantId, reservation);
    return reservation;
  }

  async update(restaurantId: string, id: string, dto: UpdateReservationDto) {
    const existing = await this.findOne(restaurantId, id);
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { timezone: true } });

    const timeSlotId = dto.timeSlotId ?? existing.timeSlotId;
    const businessDate = dto.businessDate ?? existing.businessDate.toISOString().slice(0, 10);
    const time = dto.time ?? zonedNow(existing.date, restaurant.timezone).time;
    const partySize = dto.partySize ?? existing.partySize;
    const tableIds = dto.tableIds ?? existing.tables.map((t) => t.tableId);
    const revalidate =
      dto.timeSlotId !== undefined ||
      dto.businessDate !== undefined ||
      dto.time !== undefined ||
      dto.partySize !== undefined ||
      dto.tableIds !== undefined;

    const { timeSlot, date } = await this.resolveRequest(restaurantId, timeSlotId, businessDate, time);
    const lockKey = this.lockKey(timeSlotId, businessDate);

    const reservation = await this.prisma.$transaction(async (tx) => {
      if (revalidate) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const availability = await this.evaluateAvailability(tx, restaurantId, timeSlot, {
          date,
          partySize,
          tableIds,
          excludeReservationId: id,
        });
        this.assertAvailable(availability);
      }

      if (dto.tableIds) {
        if (dto.tableIds.length) {
          await this.requireTables(tx, restaurantId, dto.tableIds);
        }
        await tx.reservationTable.deleteMany({ where: { reservationId: id } });
      }

      const scheduleChanged = dto.timeSlotId !== undefined || dto.businessDate !== undefined || dto.time !== undefined;

      return tx.reservation.update({
        where: { id },
        data: {
          timeSlotId: dto.timeSlotId,
          date: scheduleChanged ? date : undefined,
          businessDate: dto.businessDate !== undefined ? new Date(`${businessDate}T00:00:00.000Z`) : undefined,
          partySize: dto.partySize,
          guestName: dto.guestName,
          guestEmail: dto.guestEmail,
          guestPhone: dto.guestPhone,
          dietaryRestrictions: dto.dietaryRestrictions,
          accessibilityNeeds: dto.accessibilityNeeds,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          tables: dto.tableIds ? { create: dto.tableIds.map((tableId) => ({ tableId })) } : undefined,
        },
        include: RESERVATION_INCLUDE,
      });
    });

    this.eventsGateway.emitReservationUpdated(restaurantId, reservation.id, reservation.status);
    return reservation;
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdateReservationStatusDto) {
    const existing = await this.findOne(restaurantId, id);
    const newStatus = dto.status as unknown as PrismaReservationStatus;

    // Reactivating a cancelled/no-show reservation frees its capacity/table back into the pool the moment it's
    // cancelled — someone else may have booked into that slot since. Re-run the same locked availability check
    // used on create/reschedule before letting it consume capacity again.
    const isReactivating = INACTIVE_STATUSES.includes(existing.status) && !INACTIVE_STATUSES.includes(newStatus);

    let reservation;
    if (isReactivating) {
      const lockKey = this.lockKey(existing.timeSlotId, existing.businessDate.toISOString().slice(0, 10));
      reservation = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const availability = await this.evaluateAvailability(tx, restaurantId, existing.timeSlot, {
          date: existing.date,
          partySize: existing.partySize,
          tableIds: existing.tables.map((t) => t.tableId),
          excludeReservationId: id,
        });
        this.assertAvailable(availability);

        return tx.reservation.update({
          where: { id },
          data: { status: newStatus },
          include: RESERVATION_INCLUDE,
        });
      });
    } else {
      reservation = await this.prisma.reservation.update({
        where: { id },
        data: { status: newStatus },
        include: RESERVATION_INCLUDE,
      });
    }

    if (dto.status === "SEATED" && existing.tables.length > 0) {
      await Promise.all(
        existing.tables.map((t) => this.tablesService.updateStatus(restaurantId, t.tableId, { status: TableStatus.OCCUPIED })),
      );
    }

    this.eventsGateway.emitReservationUpdated(restaurantId, reservation.id, reservation.status);
    return reservation;
  }

  // ---- internals ----

  /** Validates `time` against the turno's range/grid and resolves the real UTC instant, handling midnight crossing. */
  private async resolveRequest(
    restaurantId: string,
    timeSlotId: string,
    businessDate: string,
    time: string,
  ): Promise<{ timeSlot: PrismaTimeSlot; date: Date }> {
    const timeSlot = await this.prisma.timeSlot.findFirst({ where: { id: timeSlotId, restaurantId } });
    if (!timeSlot) {
      throw new NotFoundException("Time slot not found");
    }

    if (!isTimeWithinRange(time, timeSlot.startTime, timeSlot.endTime)) {
      throw new BadRequestException(`El horario debe estar dentro del turno (${timeSlot.startTime} a ${timeSlot.endTime})`);
    }
    if (!isTimeGridAligned(time, timeSlot.startTime, timeSlot.slotIntervalMinutes)) {
      throw new BadRequestException(`El horario debe ajustarse a bloques de ${timeSlot.slotIntervalMinutes} minutos`);
    }

    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { timezone: true } });
    const dateStr = isWrappedPortion(time, timeSlot.startTime, timeSlot.endTime) ? addDays(businessDate, 1) : businessDate;
    const date = new Date(zonedTimeToUtcISO(dateStr, time, restaurant.timezone));

    return { timeSlot, date };
  }

  private async evaluateAvailability(
    client: AvailabilityClient,
    restaurantId: string,
    timeSlot: PrismaTimeSlot,
    params: AvailabilityParams,
  ): Promise<AvailabilityResult> {
    const requestedStart = params.date;
    const windowMs = (timeSlot.turnDurationMinutes + timeSlot.bufferMinutes) * 60000;
    const requestedEnd = new Date(requestedStart.getTime() + windowMs);

    // Two windows of length `windowMs` can only overlap if their start times are within `windowMs` of each
    // other, so padding the search by at least `windowMs` guarantees no overlapping reservation is missed,
    // regardless of how long a turno's turnDurationMinutes/bufferMinutes are configured.
    const searchPadding = Math.max(SEARCH_PADDING_MS, windowMs);
    const candidates = await client.reservation.findMany({
      where: {
        restaurantId,
        timeSlotId: timeSlot.id,
        status: { notIn: INACTIVE_STATUSES },
        id: params.excludeReservationId ? { not: params.excludeReservationId } : undefined,
        date: {
          gte: new Date(requestedStart.getTime() - searchPadding),
          lte: new Date(requestedEnd.getTime() + searchPadding),
        },
      },
      include: { tables: true },
    });

    const overlapping = candidates.filter((candidate) => {
      const candidateStart = candidate.date;
      const candidateEnd = new Date(candidateStart.getTime() + windowMs);
      return candidateStart < requestedEnd && requestedStart < candidateEnd;
    });

    const occupiedCovers = overlapping.reduce((sum, candidate) => sum + candidate.partySize, 0);
    const capacityOk = occupiedCovers + params.partySize <= timeSlot.capacity;

    let conflictingTableId: string | null = null;
    if (params.tableIds?.length) {
      const timeSlotTables = await this.prisma.timeSlotTable.findMany({
        where: { timeSlotId: timeSlot.id, tableId: { in: params.tableIds } },
      });
      const exclusiveTableIds = timeSlotTables.filter((t) => t.exclusive).map((t) => t.tableId);

      if (exclusiveTableIds.length > 0) {
        // A table is a single physical resource shared across every turno, not just the one being booked —
        // an "Omakase" seating and an overlapping "a la carte" seating must not be able to claim the same
        // exclusive table just because they were booked through different turnos. So this checks every active
        // reservation on the exclusive table(s), regardless of its timeSlotId, using *that* reservation's own
        // turno duration/buffer to compute its occupied window (different turnos can have different turn times).
        const tableOccupants = await client.reservation.findMany({
          where: {
            restaurantId,
            status: { notIn: INACTIVE_STATUSES },
            id: params.excludeReservationId ? { not: params.excludeReservationId } : undefined,
            tables: { some: { tableId: { in: exclusiveTableIds } } },
            date: {
              gte: new Date(requestedStart.getTime() - TABLE_CONFLICT_SEARCH_PADDING_MS),
              lte: new Date(requestedEnd.getTime() + TABLE_CONFLICT_SEARCH_PADDING_MS),
            },
          },
          include: { tables: true, timeSlot: true },
        });

        for (const occupant of tableOccupants) {
          const occupantWindowMs = (occupant.timeSlot.turnDurationMinutes + occupant.timeSlot.bufferMinutes) * 60000;
          const occupantEnd = new Date(occupant.date.getTime() + occupantWindowMs);
          const overlapsRequest = occupant.date < requestedEnd && requestedStart < occupantEnd;
          if (!overlapsRequest) continue;

          const conflict = occupant.tables.find((t) => exclusiveTableIds.includes(t.tableId));
          if (conflict) {
            conflictingTableId = conflict.tableId;
            break;
          }
        }
      }
    }

    return {
      available: capacityOk && !conflictingTableId,
      reason: !capacityOk ? "CAPACITY" : conflictingTableId ? "TABLE_CONFLICT" : null,
      remainingCapacity: Math.max(timeSlot.capacity - occupiedCovers, 0),
      conflictingTableId,
    };
  }

  private assertAvailable(availability: AvailabilityResult): void {
    if (availability.available) return;
    if (availability.reason === "CAPACITY") {
      throw new BadRequestException("No hay cupo disponible en ese turno");
    }
    throw new BadRequestException("La mesa seleccionada no está disponible en ese horario");
  }

  private async requireTables(client: TableCheckClient, restaurantId: string, tableIds: string[]): Promise<void> {
    const tables = await client.table.findMany({ where: { id: { in: tableIds }, restaurantId } });
    if (tables.length !== new Set(tableIds).size) {
      throw new BadRequestException("One or more tables were not found");
    }
  }

  private async requireClient(client: ClientCheckClient, restaurantId: string, clientId: string): Promise<void> {
    const found = await client.client.findFirst({ where: { id: clientId, restaurantId } });
    if (!found) {
      throw new BadRequestException("Client not found");
    }
  }

  private lockKey(timeSlotId: string, businessDate: string): string {
    return `${timeSlotId}:${businessDate}`;
  }
}
