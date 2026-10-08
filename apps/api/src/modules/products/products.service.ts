import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Module } from "@mangiar/shared";
import {
  Prisma,
  type PriceType as PrismaPriceType,
  type Product as PrismaProduct,
  type ProductTag as PrismaProductTag,
  type UnitType as PrismaUnitType,
  type VolumeUnit as PrismaVolumeUnit,
  type WeightUnit as PrismaWeightUnit,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StockService } from "../inventory/stock.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import type { CreateProductDto, ProductComponentDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";

const PRODUCT_INCLUDE = {
  prices: true,
  category: true,
  comboComponents: {
    include: {
      component: { select: { id: true, name: true, trackStock: true, stock: true, isCombo: true } },
    },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

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

  async create(restaurantId: string, currentUserId: string, dto: CreateProductDto): Promise<PrismaProduct> {
    await this.validateComponents(restaurantId, undefined, dto.isCombo, dto.components);

    const product = await this.prisma.product.create({
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
        comboComponents:
          dto.isCombo && dto.components?.length
            ? { create: dto.components.map((c) => ({ componentId: c.componentId, quantity: c.quantity })) }
            : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    if (dto.trackStock && dto.stock !== undefined && dto.stock > 0) {
      const activeModules = await this.subscriptionsService.getActiveModules(restaurantId);
      if (activeModules.includes(Module.INVENTORY)) {
        await this.stockService.set(restaurantId, currentUserId, {
          productId: product.id,
          stock: dto.stock,
          reason: "Stock inicial",
        });
        return this.findOne(restaurantId, product.id);
      }
    }

    return product;
  }

  async update(restaurantId: string, id: string, dto: UpdateProductDto): Promise<PrismaProduct> {
    const existing = await this.findOne(restaurantId, id);
    const effectiveIsCombo = dto.isCombo ?? existing.isCombo;
    if (dto.components || dto.isCombo !== undefined) {
      await this.validateComponents(restaurantId, id, effectiveIsCombo, dto.components);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.prices) {
        await tx.productPrice.deleteMany({ where: { productId: id } });
      }
      if (dto.components || effectiveIsCombo === false) {
        await tx.productComponent.deleteMany({ where: { comboId: id } });
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
          comboComponents:
            effectiveIsCombo && dto.components?.length
              ? { create: dto.components.map((c) => ({ componentId: c.componentId, quantity: c.quantity })) }
              : undefined,
        },
        include: PRODUCT_INCLUDE,
      });
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException(
          "No se puede eliminar este producto porque tiene pedidos u otros registros asociados. Desactivalo en su lugar.",
        );
      }
      throw error;
    }
  }

  private async validateComponents(
    restaurantId: string,
    productId: string | undefined,
    isCombo: boolean | undefined,
    components: ProductComponentDto[] | undefined,
  ): Promise<void> {
    if (!isCombo) return;

    if (!components || components.length === 0) {
      throw new BadRequestException("A combo needs at least one component");
    }
    if (productId && components.some((c) => c.componentId === productId)) {
      throw new BadRequestException("A product cannot be a component of itself");
    }
    const ids = components.map((c) => c.componentId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("A component cannot be listed twice");
    }

    const found = await this.prisma.product.findMany({
      where: { id: { in: ids }, restaurantId },
      select: { id: true, isCombo: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException("One or more components were not found");
    }
    if (found.some((p) => p.isCombo)) {
      throw new BadRequestException("A combo cannot contain another combo as a component");
    }
  }
}
