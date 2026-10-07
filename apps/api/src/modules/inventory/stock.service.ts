import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma, StockMovement as PrismaStockMovement } from "../../../generated/prisma/client";
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

  adjust(
    restaurantId: string,
    currentUserId: string,
    dto: AdjustStockDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaStockMovement> {
    return this.applyMovement(restaurantId, currentUserId, dto, (previousStock) => previousStock + dto.delta, tx);
  }

  set(
    restaurantId: string,
    currentUserId: string,
    dto: SetStockDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaStockMovement> {
    return this.applyMovement(restaurantId, currentUserId, dto, () => dto.stock, tx);
  }

  /** When `tx` is passed, the adjustment participates in the caller's own transaction (so an
   * insufficient-stock rollback also undoes whatever else the caller was doing) instead of opening
   * its own — used by OrdersService so a blocked sale rolls back the whole order atomically. */
  private async applyMovement(
    restaurantId: string,
    currentUserId: string,
    dto: MovementTarget,
    computeNewStock: (previousStock: number) => number,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaStockMovement> {
    if (Boolean(dto.productId) === Boolean(dto.ingredientId)) {
      throw new BadRequestException("Specify exactly one of productId or ingredientId");
    }

    const createdById = await this.resolveStaffId(restaurantId, dto.attributedToId, currentUserId);

    const run = async (client: Prisma.TransactionClient): Promise<PrismaStockMovement> => {
      let previousStock: number;

      if (dto.productId) {
        const product = await client.product.findFirst({ where: { id: dto.productId, restaurantId } });
        if (!product) {
          throw new BadRequestException("Product not found");
        }
        previousStock = Number(product.stock);
      } else {
        const ingredient = await client.ingredient.findFirst({ where: { id: dto.ingredientId!, restaurantId } });
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
        await client.product.update({
          where: { id: dto.productId },
          data: { stock: newStock, lastRestockedAt: newStock > previousStock ? new Date() : undefined },
        });
      } else {
        await client.ingredient.update({ where: { id: dto.ingredientId! }, data: { stock: newStock } });
      }

      return client.stockMovement.create({
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
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  private async resolveStaffId(
    restaurantId: string,
    staffId: string | undefined,
    currentUserId: string,
  ): Promise<string> {
    if (!staffId) return currentUserId;
    const staff = await this.prisma.user.findFirst({ where: { id: staffId, restaurantId } });
    if (!staff) {
      throw new BadRequestException("Selected staff user not found");
    }
    return staffId;
  }
}
