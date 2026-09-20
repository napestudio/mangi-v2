import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  DiscountType as PrismaDiscountType,
  Order as PrismaOrder,
  OrderStatus as PrismaOrderStatus,
  OrderType as PrismaOrderType,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventsGateway } from "../websockets/events.gateway";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type { UpdateOrderStatusDto } from "./dto/update-order-status.dto";

const ORDER_INCLUDE = { items: { include: { modifiers: true } } } as const;

type PriceTypeForOrder = "DINE_IN" | "TAKE_AWAY" | "DELIVERY";

function toPriceType(orderType: PrismaOrderType): PriceTypeForOrder {
  if (orderType === "DELIVERY") return "DELIVERY";
  if (orderType === "TAKE_AWAY" || orderType === "COUNTER") return "TAKE_AWAY";
  return "DINE_IN";
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  findAll(restaurantId: string): Promise<PrismaOrder[]> {
    return this.prisma.order.findMany({
      where: { restaurantId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaOrder> {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurantId },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async create(restaurantId: string, assignedToId: string, dto: CreateOrderDto): Promise<PrismaOrder> {
    const orderType = (dto.type ?? "DINE_IN") as unknown as PrismaOrderType;
    const priceType = toPriceType(orderType);

    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, restaurantId },
      include: { prices: true },
    });
    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException("One or more products were not found");
    }

    const modifierOptionIds = dto.items.flatMap((item) => item.modifiers?.map((modifier) => modifier.optionId) ?? []);
    const modifierOptions = modifierOptionIds.length
      ? await this.prisma.modifierOption.findMany({ where: { id: { in: modifierOptionIds } } })
      : [];

    let subtotal = 0;
    const itemsData = dto.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      const priceEntry = product.prices.find((price) => price.type === priceType);
      if (!priceEntry) {
        throw new BadRequestException(`Product ${product.name} has no price configured for ${priceType}`);
      }
      const unitPrice = Number(priceEntry.price);

      const modifiers = (item.modifiers ?? []).map((modifierRef) => {
        const option = modifierOptions.find((candidate) => candidate.id === modifierRef.optionId);
        if (!option) {
          throw new BadRequestException(`Modifier option ${modifierRef.optionId} not found`);
        }
        return {
          optionId: option.id,
          name: option.name,
          priceAdj: option.priceAdjustment,
        };
      });
      const modifiersTotal = modifiers.reduce((sum, modifier) => sum + Number(modifier.priceAdj), 0);
      const totalPrice = (unitPrice + modifiersTotal) * item.quantity;
      subtotal += totalPrice;

      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        notes: item.notes,
        modifiers: { create: modifiers },
      };
    });

    const discountAmount = this.computeDiscount(
      subtotal,
      dto.discountType as unknown as PrismaDiscountType | undefined,
      dto.discountValue,
    );
    const total = Math.max(subtotal - discountAmount, 0);

    const order = await this.prisma.order.create({
      data: {
        restaurantId,
        type: orderType,
        tableId: dto.tableId,
        clientId: dto.clientId,
        assignedToId,
        notes: dto.notes,
        discountType: dto.discountType as unknown as PrismaDiscountType | undefined,
        discountValue: dto.discountValue,
        discountAmount,
        subtotal,
        total,
        needsInvoice: dto.needsInvoice ?? false,
        items: { create: itemsData },
      },
      include: ORDER_INCLUDE,
    });

    this.eventsGateway.emitOrderCreated(restaurantId, order);
    return order;
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdateOrderStatusDto): Promise<PrismaOrder> {
    await this.findOne(restaurantId, id);
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status as unknown as PrismaOrderStatus },
    });
    this.eventsGateway.emitOrderUpdated(restaurantId, order.id, order.status);
    return order;
  }

  private computeDiscount(subtotal: number, type: PrismaDiscountType | undefined, value: number | undefined): number {
    if (!type || !value) return 0;
    if (type === "PERCENTAGE") return (subtotal * value) / 100;
    return value;
  }
}
