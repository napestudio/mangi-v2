import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PurchaseOrderStatus as PrismaPurchaseOrderStatus } from "../../../generated/prisma/client";
import { StockService } from "../inventory/stock.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import type { UpdatePurchaseOrderStatusDto } from "./dto/update-purchase-order-status.dto";

const PURCHASE_ORDER_INCLUDE = {
  supplier: true,
  items: { include: { product: true, ingredient: true } },
} as const;

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  findAll(restaurantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { supplier: { restaurantId } },
      include: PURCHASE_ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: { id, supplier: { restaurantId } },
      include: PURCHASE_ORDER_INCLUDE,
    });
    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found");
    }
    return purchaseOrder;
  }

  async create(restaurantId: string, dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, restaurantId } });
    if (!supplier) {
      throw new BadRequestException("Supplier not found");
    }

    for (const item of dto.items) {
      if (item.productId) {
        const product = await this.prisma.product.findFirst({ where: { id: item.productId, restaurantId } });
        if (!product) {
          throw new BadRequestException(`Product ${item.productId} not found`);
        }
      }
      if (item.ingredientId) {
        const ingredient = await this.prisma.ingredient.findFirst({ where: { id: item.ingredientId, restaurantId } });
        if (!ingredient) {
          throw new BadRequestException(`Ingredient ${item.ingredientId} not found`);
        }
      }
    }

    const itemsData = dto.items.map((item) => ({
      productId: item.productId,
      ingredientId: item.ingredientId,
      description: item.description,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.quantity * item.unitCost,
    }));
    const totalCost = itemsData.reduce((sum, item) => sum + item.totalCost, 0);

    return this.prisma.purchaseOrder.create({
      data: { supplierId: dto.supplierId, notes: dto.notes, totalCost, items: { create: itemsData } },
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    const po = await this.findOne(restaurantId, id);
    if (po.status !== "DRAFT") {
      throw new BadRequestException("Only draft purchase orders can be deleted");
    }
    await this.prisma.purchaseOrder.delete({ where: { id } });
  }

  async updateStatus(restaurantId: string, id: string, currentUserId: string, dto: UpdatePurchaseOrderStatusDto) {
    const po = await this.findOne(restaurantId, id);
    const nextStatus = dto.status as unknown as PrismaPurchaseOrderStatus;

    if (nextStatus === "RECEIVED" && po.status !== "RECEIVED") {
      for (const item of po.items) {
        if (item.productId) {
          await this.stockService.adjust(restaurantId, currentUserId, {
            productId: item.productId,
            delta: Number(item.quantity),
            reason: "Compra recibida",
            reference: po.id,
          });
        } else if (item.ingredientId) {
          await this.stockService.adjust(restaurantId, currentUserId, {
            ingredientId: item.ingredientId,
            delta: Number(item.quantity),
            reason: "Compra recibida",
            reference: po.id,
          });
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.supplierLedgerEntry.create({
          data: {
            supplierId: po.supplierId,
            type: "PURCHASE",
            amount: po.totalCost ?? 0,
            purchaseOrderId: po.id,
            createdById: currentUserId,
          },
        });
        await tx.supplier.update({ where: { id: po.supplierId }, data: { balance: { increment: po.totalCost ?? 0 } } });
        await tx.purchaseOrder.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date() } });
      });
    } else {
      await this.prisma.purchaseOrder.update({
        where: { id },
        data: { status: nextStatus, orderedAt: nextStatus === "ORDERED" ? new Date() : undefined },
      });
    }

    return this.findOne(restaurantId, id);
  }
}
