import { Injectable, NotFoundException } from "@nestjs/common";
import type { Ingredient as PrismaIngredient } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateIngredientDto } from "./dto/create-ingredient.dto";
import type { UpdateIngredientDto } from "./dto/update-ingredient.dto";

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<PrismaIngredient[]> {
    return this.prisma.ingredient.findMany({ where: { restaurantId }, orderBy: { name: "asc" } });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaIngredient> {
    const ingredient = await this.prisma.ingredient.findFirst({ where: { id, restaurantId } });
    if (!ingredient) {
      throw new NotFoundException("Ingredient not found");
    }
    return ingredient;
  }

  create(restaurantId: string, dto: CreateIngredientDto): Promise<PrismaIngredient> {
    return this.prisma.ingredient.create({ data: { ...dto, restaurantId } });
  }

  async update(restaurantId: string, id: string, dto: UpdateIngredientDto): Promise<PrismaIngredient> {
    await this.findOne(restaurantId, id);
    return this.prisma.ingredient.update({ where: { id }, data: dto });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.ingredient.delete({ where: { id } });
  }
}
