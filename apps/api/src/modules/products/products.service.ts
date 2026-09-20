import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  PriceType as PrismaPriceType,
  Product as PrismaProduct,
  ProductTag as PrismaProductTag,
  UnitType as PrismaUnitType,
  VolumeUnit as PrismaVolumeUnit,
  WeightUnit as PrismaWeightUnit,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";

const PRODUCT_INCLUDE = { prices: true, category: true } as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<PrismaProduct[]> {
    return this.prisma.product.findMany({
      where: { restaurantId },
      include: PRODUCT_INCLUDE,
      orderBy: { sortOrder: "asc" },
    });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaProduct> {
    const product = await this.prisma.product.findFirst({
      where: { id, restaurantId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }

  create(restaurantId: string, dto: CreateProductDto): Promise<PrismaProduct> {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        image: dto.image,
        sku: dto.sku,
        categoryId: dto.categoryId,
        unitType: dto.unitType as unknown as PrismaUnitType | undefined,
        weightUnit: dto.weightUnit as unknown as PrismaWeightUnit | undefined,
        volumeUnit: dto.volumeUnit as unknown as PrismaVolumeUnit | undefined,
        isActive: dto.isActive,
        isCombo: dto.isCombo,
        trackStock: dto.trackStock,
        minStock: dto.minStock,
        maxStock: dto.maxStock,
        tags: dto.tags as unknown as PrismaProductTag[] | undefined,
        sortOrder: dto.sortOrder,
        restaurantId,
        prices: {
          create: dto.prices.map((price) => ({
            type: price.type as unknown as PrismaPriceType,
            price: price.price,
          })),
        },
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateProductDto): Promise<PrismaProduct> {
    await this.findOne(restaurantId, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.prices) {
        await tx.productPrice.deleteMany({ where: { productId: id } });
      }

      return tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          image: dto.image,
          sku: dto.sku,
          categoryId: dto.categoryId,
          unitType: dto.unitType as unknown as PrismaUnitType | undefined,
          weightUnit: dto.weightUnit as unknown as PrismaWeightUnit | undefined,
          volumeUnit: dto.volumeUnit as unknown as PrismaVolumeUnit | undefined,
          isActive: dto.isActive,
          isCombo: dto.isCombo,
          trackStock: dto.trackStock,
          minStock: dto.minStock,
          maxStock: dto.maxStock,
          tags: dto.tags as unknown as PrismaProductTag[] | undefined,
          sortOrder: dto.sortOrder,
          prices: dto.prices
            ? {
                create: dto.prices.map((price) => ({
                  type: price.type as unknown as PrismaPriceType,
                  price: price.price,
                })),
              }
            : undefined,
        },
        include: PRODUCT_INCLUDE,
      });
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.product.delete({ where: { id } });
  }
}
