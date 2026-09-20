import { Injectable, NotFoundException } from "@nestjs/common";
import type { Restaurant as PrismaRestaurant } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateRestaurantDto } from "./dto/update-restaurant.dto";

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PrismaRestaurant> {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException("Restaurant not found");
    }
    return restaurant;
  }

  async update(id: string, dto: UpdateRestaurantDto): Promise<PrismaRestaurant> {
    await this.findById(id);
    return this.prisma.restaurant.update({ where: { id }, data: dto });
  }
}
