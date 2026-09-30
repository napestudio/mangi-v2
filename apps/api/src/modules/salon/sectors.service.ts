import { Injectable, NotFoundException } from "@nestjs/common";
import type { Sector as PrismaSector } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateSectorDto } from "./dto/create-sector.dto";
import type { UpdateSectorDto } from "./dto/update-sector.dto";

@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<PrismaSector[]> {
    return this.prisma.sector.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaSector> {
    const sector = await this.prisma.sector.findFirst({ where: { id, restaurantId } });
    if (!sector) {
      throw new NotFoundException("Sector not found");
    }
    return sector;
  }

  create(restaurantId: string, dto: CreateSectorDto): Promise<PrismaSector> {
    return this.prisma.sector.create({ data: { ...dto, restaurantId } });
  }

  async update(restaurantId: string, id: string, dto: UpdateSectorDto): Promise<PrismaSector> {
    await this.findOne(restaurantId, id);
    return this.prisma.sector.update({ where: { id }, data: dto });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.sector.delete({ where: { id } });
  }
}
