import { Injectable, NotFoundException } from "@nestjs/common";
import type { DeliveryZone as PrismaDeliveryZone } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryConfigService } from "./delivery-config.service";
import type { CreateDeliveryZoneDto } from "./dto/create-delivery-zone.dto";
import type { UpdateDeliveryZoneDto } from "./dto/update-delivery-zone.dto";

@Injectable()
export class DeliveryZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryConfigService: DeliveryConfigService,
  ) {}

  async findAll(restaurantId: string): Promise<PrismaDeliveryZone[]> {
    const config = await this.deliveryConfigService.findOrCreate(restaurantId);
    return this.prisma.deliveryZone.findMany({
      where: { deliveryConfigId: config.id },
      orderBy: { priority: "asc" },
    });
  }

  async create(restaurantId: string, dto: CreateDeliveryZoneDto): Promise<PrismaDeliveryZone> {
    const config = await this.deliveryConfigService.findOrCreate(restaurantId);
    return this.prisma.deliveryZone.create({
      data: {
        deliveryConfigId: config.id,
        name: dto.name,
        type: dto.type,
        minRadiusMeters: dto.minRadiusMeters,
        maxRadiusMeters: dto.maxRadiusMeters,
        fee: dto.fee,
        estimatedMinutes: dto.estimatedMinutes,
        priority: dto.priority,
        isActive: dto.isActive,
      },
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateDeliveryZoneDto): Promise<PrismaDeliveryZone> {
    await this.requireZone(restaurantId, id);
    return this.prisma.deliveryZone.update({ where: { id }, data: dto });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.requireZone(restaurantId, id);
    await this.prisma.deliveryZone.delete({ where: { id } });
  }

  private async requireZone(restaurantId: string, id: string): Promise<PrismaDeliveryZone> {
    const zone = await this.prisma.deliveryZone.findFirst({ where: { id, deliveryConfig: { restaurantId } } });
    if (!zone) {
      throw new NotFoundException("Delivery zone not found");
    }
    return zone;
  }
}
