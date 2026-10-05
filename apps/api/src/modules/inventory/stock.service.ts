import { BadRequestException, Injectable } from "@nestjs/common";
import type { StockMovement as PrismaStockMovement } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdjustStockDto } from "./dto/adjust-stock.dto";
import type { ListStockMovementsDto } from "./dto/list-stock-movements.dto";
import type { SetStockDto } from "./dto/set-stock.dto";

const MOVEMENT_INCLUDE = { createdBy: { select: { id: true, name: true, username: true } } } as const;

interface MovementTarget {
  productId?: string;
  ingredientId?: string;
  reason: string;
  notes?: string;
  reference?: string;
  attributedToId?: string;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  findMovements(restaurantId: string, query: ListStockMovementsDto) {
    return this.prisma.stockMovement.findMany({
      where: { restaurantId, productId: query.productId, ingredientId: query.ingredientId },
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  adjust(restaurantId: string, currentUserId: string, dto: AdjustStockDto): Promise<PrismaStockMovement> {
    return this.applyMovement(restaurantId, currentUserId, dto, (previousStock) => previousStock + dto.delta);
  }

  set(restaurantId: string, currentUserId: string, dto: SetStockDto): Promise<PrismaStockMovement> {
    return this.applyMovement(restaurantId, currentUserId, dto, () => dto.stock);
  }

  private async applyMovement(
    restaurantId: string,
    currentUserId: string,
    dto: MovementTarget,
    computeNewStock: (previousStock: number) => number,
  ): Promise<PrismaStockMovement> {
    if (Boolean(dto.productId) === Boolean(dto.ingredientId)) {
      throw new BadRequestException("Specify exactly one of productId or ingredientId");
    }

    const createdById = await this.resolveStaffId(restaurantId, dto.attributedToId, currentUserId);

    return this.prisma.$transaction(async (tx) => {
      let previousStock: number;

      if (dto.productId) {
        const product = await tx.product.findFirst({ where: { id: dto.productId, restaurantId } });
        if (!product) {
          throw new BadRequestException("Product not found");
        }
        previousStock = Number(product.stock);
      } else {
        const ingredient = await tx.ingredient.findFirst({ where: { id: dto.ingredientId!, restaurantId } });
        if (!ingredient) {
          throw new BadRequestException("Ingredient not found");
        }
        previousStock = Number(ingredient.stock);
      }

      const newStock = computeNewStock(previousStock);
      if (newStock < 0) {
        throw new BadRequestException("Stock cannot go negative");
      }

      if (dto.productId) {
        await tx.product.update({
          where: { id: dto.productId },
          data: { stock: newStock, lastRestockedAt: newStock > previousStock ? new Date() : undefined },
        });
      } else {
        await tx.ingredient.update({ where: { id: dto.ingredientId! }, data: { stock: newStock } });
      }

      return tx.stockMovement.create({
        data: {
          restaurantId,
          productId: dto.productId,
          ingredientId: dto.ingredientId,
          quantity: newStock - previousStock,
          previousStock,
          newStock,
          reason: dto.reason,
          notes: dto.notes,
          reference: dto.reference,
          createdById,
        },
        include: MOVEMENT_INCLUDE,
      });
    });
  }

  private async resolveStaffId(restaurantId: string, staffId: string | undefined, currentUserId: string): Promise<string> {
    if (!staffId) return currentUserId;
    const staff = await this.prisma.user.findFirst({ where: { id: staffId, restaurantId } });
    if (!staff) {
      throw new BadRequestException("Selected staff user not found");
    }
    return staffId;
  }
}
