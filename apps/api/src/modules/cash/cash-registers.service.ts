import { Injectable, NotFoundException } from "@nestjs/common";
import type { CashRegister as PrismaCashRegister } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import type { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

const CASH_REGISTER_INCLUDE = {
  sectors: { include: { sector: true } },
  sessions: { where: { status: "OPEN" as const }, take: 1 },
} as const;

@Injectable()
export class CashRegistersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string) {
    return this.prisma.cashRegister.findMany({
      where: { restaurantId },
      include: CASH_REGISTER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id, restaurantId },
      include: CASH_REGISTER_INCLUDE,
    });
    if (!register) {
      throw new NotFoundException("Cash register not found");
    }
    return register;
  }

  async create(restaurantId: string, dto: CreateCashRegisterDto): Promise<PrismaCashRegister> {
    return this.prisma.cashRegister.create({
      data: {
        name: dto.name,
        restaurantId,
        sectors: dto.sectorIds ? { create: dto.sectorIds.map((sectorId) => ({ sectorId })) } : undefined,
      },
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateCashRegisterDto): Promise<PrismaCashRegister> {
    await this.findOne(restaurantId, id);

    if (dto.sectorIds) {
      await this.prisma.cashRegisterOnSector.deleteMany({ where: { cashRegisterId: id } });
    }

    return this.prisma.cashRegister.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        sectors: dto.sectorIds ? { create: dto.sectorIds.map((sectorId) => ({ sectorId })) } : undefined,
      },
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.cashRegister.delete({ where: { id } });
  }
}
