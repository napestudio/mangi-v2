import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type {
  OrderStatus as PrismaOrderStatus,
  Table as PrismaTable,
  TableShape as PrismaTableShape,
  TableStatus as PrismaTableStatus,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateTableDto } from "./dto/create-table.dto";
import type { MoveTableDto } from "./dto/move-table.dto";
import type { UpdateTableDto } from "./dto/update-table.dto";
import type { UpdateTableStatusDto } from "./dto/update-table-status.dto";

const OPEN_ORDER_STATUSES: PrismaOrderStatus[] = ["PENDING", "IN_PROGRESS"];

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
    await this.ensureNumberAvailable(restaurantId, dto.number);
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
    if (dto.number) {
      await this.ensureNumberAvailable(restaurantId, dto.number, id);
    }
    return this.prisma.table.update({
      where: { id },
      data: { ...dto, shape: dto.shape as unknown as PrismaTableShape | undefined },
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);

    const activeOrders = await this.prisma.order.count({
      where: { tableId: id, status: { in: OPEN_ORDER_STATUSES } },
    });
    if (activeOrders > 0) {
      throw new ConflictException("No se puede eliminar una mesa con pedidos activos");
    }

    try {
      await this.prisma.table.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("No se puede eliminar esta mesa porque tiene reservas asociadas");
      }
      throw error;
    }
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

  private async ensureNumberAvailable(restaurantId: string, number: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.table.findFirst({
      where: { restaurantId, number, id: excludeId ? { not: excludeId } : undefined },
    });
    if (existing) {
      throw new ConflictException(`Ya existe una mesa con el número ${number}`);
    }
  }
}
