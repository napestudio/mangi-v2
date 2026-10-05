import { Injectable } from "@nestjs/common";
import type { DeliveryConfig as PrismaDeliveryConfig } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateDeliveryConfigDto } from "./dto/update-delivery-config.dto";

@Injectable()
export class DeliveryConfigService {
  constructor(private readonly prisma: PrismaService) {}

  findOrCreate(restaurantId: string): Promise<PrismaDeliveryConfig> {
    return this.prisma.deliveryConfig.upsert({
      where: { restaurantId },
      create: { restaurantId },
      update: {},
    });
  }

  async update(restaurantId: string, dto: UpdateDeliveryConfigDto): Promise<PrismaDeliveryConfig> {
    await this.findOrCreate(restaurantId);
    return this.prisma.deliveryConfig.update({ where: { restaurantId }, data: dto });
  }
}
