import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Module } from "@mangiar/shared";
import type {
  DiscountType as PrismaDiscountType,
  Order as PrismaOrder,
  OrderStatus as PrismaOrderStatus,
  OrderType as PrismaOrderType,
  PaymentMethodExtended as PrismaPaymentMethodExtended,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PrintJobsService } from "../printing/print-jobs.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { EventsGateway } from "../websockets/events.gateway";
import type { CheckoutOrderDto } from "./dto/checkout-order.dto";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type { SendToKitchenDto } from "./dto/send-to-kitchen.dto";
import type { UpdateOrderStatusDto } from "./dto/update-order-status.dto";

const ORDER_INCLUDE = {
  items: { include: { modifiers: true } },
  invoices: { select: { id: true, status: true }, orderBy: { createdAt: "desc" as const } },
} as const;

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
    private readonly subscriptionsService: SubscriptionsService,
    private readonly printJobsService: PrintJobsService,
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

  async create(restaurantId: string, currentUserId: string, dto: CreateOrderDto): Promise<PrismaOrder> {
    const orderType = (dto.type ?? "DINE_IN") as unknown as PrismaOrderType;
    const priceType = toPriceType(orderType);

    if (orderType === "COUNTER" && dto.tableId) {
      throw new BadRequestException("Counter orders cannot be assigned to a table");
    }
    if (orderType === "DELIVERY" && !dto.deliveryAddress) {
      throw new BadRequestException("Delivery orders require a delivery address");
    }
    if (orderType === "DINE_IN" && !dto.tableId) {
      const activeModules = await this.subscriptionsService.getActiveModules(restaurantId);
      if (activeModules.includes(Module.SALON)) {
        throw new BadRequestException("Dine-in orders require a table when the Salón module is active");
      }
    }

    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, restaurantId },
      include: { prices: true },
    });
    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException("One or more products were not found");
    }

    const assignedToId = dto.assignedToId ?? currentUserId;
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findFirst({ where: { id: dto.assignedToId, restaurantId } });
      if (!assignee) {
        throw new BadRequestException("Assigned user not found");
      }
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

    const deliveryFee = orderType === "DELIVERY" ? await this.resolveDeliveryFee(restaurantId, dto.deliveryZoneId) : 0;
    const total = Math.max(subtotal - discountAmount, 0) + deliveryFee;

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
        deliveryFee,
        total,
        needsInvoice: dto.needsInvoice ?? false,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryPhone: dto.deliveryPhone,
        deliveryName: dto.deliveryName,
        deliveryZoneId: orderType === "DELIVERY" ? dto.deliveryZoneId : undefined,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
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

  async checkout(restaurantId: string, currentUserId: string, id: string, dto: CheckoutOrderDto): Promise<PrismaOrder> {
    const order = await this.findOne(restaurantId, id);
    if (order.status === "COMPLETED" || order.status === "CANCELED") {
      throw new BadRequestException(`Order is already ${order.status.toLowerCase()}`);
    }

    const activeModules = await this.subscriptionsService.getActiveModules(restaurantId);
    const cashActive = activeModules.includes(Module.CASH);

    if (!cashActive) {
      const closed = await this.prisma.order.update({
        where: { id },
        data: { status: "COMPLETED", closedAt: new Date(), paymentMethodExt: dto.paymentMethodExt as unknown as PrismaPaymentMethodExtended },
        include: ORDER_INCLUDE,
      });
      this.eventsGateway.emitOrderUpdated(restaurantId, closed.id, closed.status);
      await this.printJobsService.enqueueReceipt(restaurantId, closed.id);
      return closed;
    }

    if (!dto.sessionId) {
      throw new BadRequestException("A cash session is required to checkout while the Cash module is active");
    }

    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id: dto.sessionId, cashRegister: { restaurantId } },
    });
    if (!session) {
      throw new NotFoundException("Cash session not found");
    }
    if (session.status !== "OPEN") {
      throw new BadRequestException("Cannot checkout against a closed cash session");
    }

    const closed = await this.prisma.$transaction(async (tx) => {
      await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          type: "SALE",
          method: dto.paymentMethodExt as unknown as PrismaPaymentMethodExtended,
          amount: order.total,
          description: `Pedido #${order.id}`,
          createdById: currentUserId,
        },
      });

      return tx.order.update({
        where: { id },
        data: { status: "COMPLETED", closedAt: new Date(), paymentMethodExt: dto.paymentMethodExt as unknown as PrismaPaymentMethodExtended },
        include: ORDER_INCLUDE,
      });
    });

    this.eventsGateway.emitOrderUpdated(restaurantId, closed.id, closed.status);
    await this.printJobsService.enqueueReceipt(restaurantId, closed.id);
    return closed;
  }

  async sendItemsToKitchen(restaurantId: string, orderId: string, dto: SendToKitchenDto): Promise<void> {
    await this.findOne(restaurantId, orderId);
    await this.prisma.orderItem.updateMany({
      where: { id: { in: dto.itemIds }, orderId },
      data: { sentToKitchen: true },
    });
    await this.printJobsService.enqueueKitchenTickets(restaurantId, orderId, dto.itemIds);
  }

  private computeDiscount(subtotal: number, type: PrismaDiscountType | undefined, value: number | undefined): number {
    if (!type || !value) return 0;
    if (type === "PERCENTAGE") return (subtotal * value) / 100;
    return value;
  }

  private async resolveDeliveryFee(restaurantId: string, deliveryZoneId: string | undefined): Promise<number> {
    if (deliveryZoneId) {
      const zone = await this.prisma.deliveryZone.findFirst({
        where: { id: deliveryZoneId, isActive: true, deliveryConfig: { restaurantId } },
      });
      if (!zone) {
        throw new BadRequestException("Delivery zone not found or inactive");
      }
      return Number(zone.fee);
    }

    const config = await this.prisma.deliveryConfig.findUnique({ where: { restaurantId } });
    return config ? Number(config.deliveryFee) : 0;
  }
}
