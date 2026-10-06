import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type {
  OrderStatus as PrismaOrderStatus,
  ReservationStatus as PrismaReservationStatus,
  Table as PrismaTable,
  TableShape as PrismaTableShape,
  TableStatus as PrismaTableStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateTableDto } from './dto/create-table.dto';
import type { MoveTableDto } from './dto/move-table.dto';
import type { UpdateTableDto } from './dto/update-table.dto';
import type { UpdateTableStatusDto } from './dto/update-table-status.dto';

const OPEN_ORDER_STATUSES: PrismaOrderStatus[] = ['PENDING', 'IN_PROGRESS'];
// Reservas que todavía esperan ocupar la mesa — a diferencia de Reservas (ver evaluateAvailability
// en reservations.service.ts), acá COMPLETED tampoco bloquea: ya pasó, no hay nada que proteger.
const BLOCKING_RESERVATION_STATUSES: PrismaReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'SEATED',
];

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    restaurantId: string,
    sectorId?: string,
  ): Promise<Array<PrismaTable & { activeOrderCount: number }>> {
    const tables = await this.prisma.table.findMany({
      where: { restaurantId, sectorId },
      include: {
        _count: {
          select: {
            orders: { where: { status: { in: OPEN_ORDER_STATUSES } } },
          },
        },
      },
    });
    return tables.map(({ _count, ...table }) => ({
      ...table,
      activeOrderCount: _count.orders,
    }));
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaTable> {
    const table = await this.prisma.table.findFirst({
      where: { id, restaurantId },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table;
  }

  async create(
    restaurantId: string,
    dto: CreateTableDto,
  ): Promise<PrismaTable> {
    await this.requireSector(restaurantId, dto.sectorId);
    await this.ensureNumberAvailable(restaurantId, dto.number);
    return this.prisma.table.create({
      data: {
        ...dto,
        shape: dto.shape as unknown as PrismaTableShape | undefined,
        restaurantId,
      },
    });
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateTableDto,
  ): Promise<PrismaTable> {
    await this.findOne(restaurantId, id);
    if (dto.sectorId) {
      await this.requireSector(restaurantId, dto.sectorId);
    }
    if (dto.number) {
      await this.ensureNumberAvailable(restaurantId, dto.number, id);
    }
    return this.prisma.table.update({
      where: { id },
      data: {
        ...dto,
        shape: dto.shape as unknown as PrismaTableShape | undefined,
      },
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);

    const activeOrders = await this.prisma.order.count({
      where: { tableId: id, status: { in: OPEN_ORDER_STATUSES } },
    });
    if (activeOrders > 0) {
      throw new ConflictException(
        'No se puede eliminar una mesa con pedidos activos',
      );
    }

    const activeReservations = await this.prisma.reservationTable.count({
      where: {
        tableId: id,
        reservation: { status: { in: BLOCKING_RESERVATION_STATUSES } },
      },
    });
    if (activeReservations > 0) {
      throw new ConflictException(
        'No se puede eliminar una mesa con reservas activas',
      );
    }

    // Reservas CANCELED/NO_SHOW/COMPLETED no bloquean, pero su ReservationTable sigue
    // referenciando esta mesa (no tiene onDelete: Cascade a propósito, para no perder el
    // vínculo histórico mientras la mesa existe) — hay que soltarlas antes del delete o
    // Postgres tira P2003 igual, aunque ya no haya nada "activo" que proteger.
    await this.prisma.reservationTable.deleteMany({ where: { tableId: id } });

    try {
      await this.prisma.table.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar esta mesa porque tiene reservas asociadas',
        );
      }
      throw error;
    }
  }

  async move(
    restaurantId: string,
    id: string,
    dto: MoveTableDto,
  ): Promise<PrismaTable> {
    await this.findOne(restaurantId, id);
    return this.prisma.table.update({ where: { id }, data: dto });
  }

  async updateStatus(
    restaurantId: string,
    id: string,
    dto: UpdateTableStatusDto,
  ): Promise<PrismaTable> {
    await this.findOne(restaurantId, id);
    return this.prisma.table.update({
      where: { id },
      data: { status: dto.status as unknown as PrismaTableStatus },
    });
  }

  private async requireSector(
    restaurantId: string,
    sectorId: string,
  ): Promise<void> {
    const sector = await this.prisma.sector.findFirst({
      where: { id: sectorId, restaurantId },
    });
    if (!sector) {
      throw new BadRequestException('Sector not found');
    }
  }

  private async ensureNumberAvailable(
    restaurantId: string,
    number: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.table.findFirst({
      where: {
        restaurantId,
        number,
        id: excludeId ? { not: excludeId } : undefined,
      },
    });
    if (existing) {
      throw new ConflictException(`Ya existe una mesa con el número ${number}`);
    }
  }
}
