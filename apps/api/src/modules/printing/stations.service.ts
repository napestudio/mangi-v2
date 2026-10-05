import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateStationDto } from "./dto/create-station.dto";
import type { UpdateStationDto } from "./dto/update-station.dto";

const STATION_INCLUDE = { categories: { include: { category: true } }, printers: true } as const;

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string) {
    return this.prisma.station.findMany({
      where: { restaurantId },
      include: STATION_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const station = await this.prisma.station.findFirst({ where: { id, restaurantId }, include: STATION_INCLUDE });
    if (!station) {
      throw new NotFoundException("Station not found");
    }
    return station;
  }

  create(restaurantId: string, dto: CreateStationDto) {
    return this.prisma.station.create({
      data: {
        restaurantId,
        name: dto.name,
        color: dto.color,
        categories: dto.categoryIds?.length ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
      },
      include: STATION_INCLUDE,
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateStationDto) {
    await this.findOne(restaurantId, id);

    if (dto.categoryIds) {
      await this.prisma.stationCategory.deleteMany({ where: { stationId: id } });
    }

    return this.prisma.station.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
        categories: dto.categoryIds ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
      },
      include: STATION_INCLUDE,
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.station.delete({ where: { id } });
  }
}
