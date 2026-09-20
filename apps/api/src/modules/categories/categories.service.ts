import { Injectable, NotFoundException } from "@nestjs/common";
import type { Category as PrismaCategory } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<PrismaCategory[]> {
    return this.prisma.category.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaCategory> {
    const category = await this.prisma.category.findFirst({ where: { id, restaurantId } });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }

  create(restaurantId: string, dto: CreateCategoryDto): Promise<PrismaCategory> {
    return this.prisma.category.create({ data: { ...dto, restaurantId } });
  }

  async update(restaurantId: string, id: string, dto: UpdateCategoryDto): Promise<PrismaCategory> {
    await this.findOne(restaurantId, id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.category.delete({ where: { id } });
  }
}
