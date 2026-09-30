import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { TimeSlot as PrismaTimeSlot } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AssignTimeSlotTablesDto } from "./dto/assign-time-slot-tables.dto";
import type { CreateTimeSlotDto } from "./dto/create-time-slot.dto";
import type { UpdateTimeSlotDto } from "./dto/update-time-slot.dto";

const TIME_SLOT_INCLUDE = { timeSlotTables: { include: { table: true } } } as const;

@Injectable()
export class TimeSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string) {
    return this.prisma.timeSlot.findMany({
      where: { restaurantId },
      include: TIME_SLOT_INCLUDE,
      orderBy: { startTime: "asc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const timeSlot = await this.prisma.timeSlot.findFirst({
      where: { id, restaurantId },
      include: TIME_SLOT_INCLUDE,
    });
    if (!timeSlot) {
      throw new NotFoundException("Time slot not found");
    }
    return timeSlot;
  }

  create(restaurantId: string, dto: CreateTimeSlotDto): Promise<PrismaTimeSlot> {
    return this.prisma.timeSlot.create({ data: { ...dto, restaurantId } });
  }

  async update(restaurantId: string, id: string, dto: UpdateTimeSlotDto): Promise<PrismaTimeSlot> {
    await this.findOne(restaurantId, id);
    return this.prisma.timeSlot.update({ where: { id }, data: dto });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.timeSlot.delete({ where: { id } });
  }

  async assignTables(restaurantId: string, id: string, dto: AssignTimeSlotTablesDto) {
    await this.findOne(restaurantId, id);

    const tableIds = dto.tables.map((t) => t.tableId);
    if (tableIds.length > 0) {
      const tables = await this.prisma.table.findMany({ where: { id: { in: tableIds }, restaurantId } });
      if (tables.length !== new Set(tableIds).size) {
        throw new BadRequestException("One or more tables were not found");
      }
    }

    await this.prisma.$transaction([
      this.prisma.timeSlotTable.deleteMany({ where: { timeSlotId: id } }),
      this.prisma.timeSlotTable.createMany({
        data: dto.tables.map((t) => ({ timeSlotId: id, tableId: t.tableId, exclusive: t.exclusive })),
      }),
    ]);

    return this.findOne(restaurantId, id);
  }
}
