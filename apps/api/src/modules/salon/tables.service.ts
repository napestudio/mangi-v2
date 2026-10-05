import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Table as PrismaTable, TableShape as PrismaTableShape, TableStatus as PrismaTableStatus } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateTableDto } from "./dto/create-table.dto";
import type { MoveTableDto } from "./dto/move-table.dto";
import type { UpdateTableDto } from "./dto/update-table.dto";
import type { UpdateTableStatusDto } from "./dto/update-table-status.dto";

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string, sectorId?: string): Promise<PrismaTable[]> {
    return this.prisma.table.findMany({ where: { restaurantId, sectorId } });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaTable> {
    const table = await this.prisma.table.findFirst({ where: { id, restaurantId } });
    if (!table) {
      throw new NotFoundException("Table not found");
    }
    return table;
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<PrismaTable> {
    await this.requireSector(restaurantId, dto.sectorId);
    return this.prisma.table.create({
      data: {
        ...dto,
        shape: dto.shape as unknown as PrismaTableShape | undefined,
        restaurantId,
      },
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateTableDto): Promise<PrismaTable> {
    await this.findOne(restaurantId, id);
    if (dto.sectorId) {
      await this.requireSector(restaurantId, dto.sectorId);
    }
    return this.prisma.table.update({
      where: { id },
      data: { ...dto, shape: dto.shape as unknown as PrismaTableShape | undefined },
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.table.delete({ where: { id } });
  }

  async move(restaurantId: string, id: string, dto: MoveTableDto): Promise<PrismaTable> {
    await this.findOne(restaurantId, id);
    return this.prisma.table.update({ where: { id }, data: dto });
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdateTableStatusDto): Promise<PrismaTable> {
    await this.findOne(restaurantId, id);
    return this.prisma.table.update({
      where: { id },
      data: { status: dto.status as unknown as PrismaTableStatus },
    });
  }

  private async requireSector(restaurantId: string, sectorId: string): Promise<void> {
    const sector = await this.prisma.sector.findFirst({ where: { id: sectorId, restaurantId } });
    if (!sector) {
      throw new BadRequestException("Sector not found");
    }
  }
}
