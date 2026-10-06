import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  buildOrderCode,
  Module,
  OrderType,
  TableStatus,
} from '@mangiar/shared';
import type {
  DiscountType as PrismaDiscountType,
  OrderStatus as PrismaOrderStatus,
  OrderType as PrismaOrderType,
  PaymentMethodExtended as PrismaPaymentMethodExtended,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrintJobsService } from '../printing/print-jobs.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EventsGateway } from '../websockets/events.gateway';
import type { AddOrderItemsDto } from './dto/add-order-items.dto';
import type { CheckoutOrderDto } from './dto/checkout-order.dto';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { ListOrdersDto } from './dto/list-orders.dto';
import type { MoveOrderTableDto } from './dto/move-order-table.dto';
import type { SendToKitchenDto } from './dto/send-to-kitchen.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const ORDER_INCLUDE = {
  items: { include: { modifiers: true } },
  invoices: {
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' as const },
  },
  table: { select: { id: true, number: true } },
  restaurant: { select: { name: true } },
} as const;

type PrismaOrder = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
type OrderWithCode = Omit<PrismaOrder, 'restaurant'> & { code: string };

/** "YYYY-MM-DD" of `now` in the restaurant's own timezone, used as the daily reset key for order codes. */
function restaurantDayKey(timezone: string, now: Date): Date {
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${dateKey}T00:00:00.000Z`);
}

const OPEN_ORDER_STATUSES: PrismaOrderStatus[] = ['PENDING', 'IN_PROGRESS'];

type PriceTypeForOrder = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY';

function toPriceType(orderType: PrismaOrderType): PriceTypeForOrder {
  if (orderType === 'DELIVERY') return 'DELIVERY';
  if (orderType === 'TAKE_AWAY' || orderType === 'COUNTER') return 'TAKE_AWAY';
  return 'DINE_IN';
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly printJobsService: PrintJobsService,
  ) {}

  /** Attaches the human-friendly `code` (ej. "MGDI-37") and drops the `restaurant` join used only to build it. */
  private withCode(order: PrismaOrder): OrderWithCode {
    const { restaurant, ...rest } = order;
    return {
      ...rest,
      code: buildOrderCode(
        restaurant.name,
        order.type as unknown as OrderType,
        order.orderNumber,
      ),
    };
  }

  async findAll(
    restaurantId: string,
    query: ListOrdersDto = {},
  ): Promise<OrderWithCode[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        ...(query.tableId ? { tableId: query.tableId } : {}),
        ...(query.status?.length
          ? { status: { in: query.status as unknown as PrismaOrderStatus[] } }
          : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.withCode(order));
  }

  async findOne(restaurantId: string, id: string): Promise<OrderWithCode> {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurantId },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.withCode(order);
  }

  async create(
    restaurantId: string,
    currentUserId: string,
    dto: CreateOrderDto,
  ): Promise<OrderWithCode> {
    const orderType = (dto.type ?? 'DINE_IN') as unknown as PrismaOrderType;
    const priceType = toPriceType(orderType);

    if (orderType === 'COUNTER' && dto.tableId) {
      throw new BadRequestException(
        'Counter orders cannot be assigned to a table',
      );
    }
    if (orderType === 'DELIVERY' && !dto.deliveryAddress) {
      throw new BadRequestException(
        'Delivery orders require a delivery address',
      );
    }
    if (orderType === 'DINE_IN' && !dto.tableId) {
      const activeModules =
        await this.subscriptionsService.getActiveModules(restaurantId);
      if (activeModules.includes(Module.SALON)) {
        throw new BadRequestException(
          'Dine-in orders require a table when the Salón module is active',
        );
      }
    }

    const productIds = dto.items.map((item) => item.productId);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, restaurantId },
          include: { prices: true },
        })
      : [];
    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException('One or more products were not found');
    }

    const assignedToId = dto.assignedToId ?? currentUserId;
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, restaurantId },
      });
      if (!assignee) {
        throw new BadRequestException('Assigned user not found');
      }
    }

    const modifierOptionIds = dto.items.flatMap(
      (item) => item.modifiers?.map((modifier) => modifier.optionId) ?? [],
    );
    const modifierOptions = modifierOptionIds.length
      ? await this.prisma.modifierOption.findMany({
          where: { id: { in: modifierOptionIds } },
        })
      : [];

    let subtotal = 0;
    const itemsData = dto.items.map((item) => {
      const product = products.find(
        (candidate) => candidate.id === item.productId,
      );
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      const priceEntry = product.prices.find(
        (price) => price.type === priceType,
      );
      if (!priceEntry) {
        throw new BadRequestException(
          `Product ${product.name} has no price configured for ${priceType}`,
        );
      }
      const unitPrice = Number(priceEntry.price);

      const modifiers = (item.modifiers ?? []).map((modifierRef) => {
        const option = modifierOptions.find(
          (candidate) => candidate.id === modifierRef.optionId,
        );
        if (!option) {
          throw new BadRequestException(
            `Modifier option ${modifierRef.optionId} not found`,
          );
        }
        return {
          optionId: option.id,
          name: option.name,
          priceAdj: option.priceAdjustment,
        };
      });
      const modifiersTotal = modifiers.reduce(
        (sum, modifier) => sum + Number(modifier.priceAdj),
        0,
      );
      const totalPrice = (unitPrice + modifiersTotal) * item.quantity;
      subtotal += totalPrice;

      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        notes: item.notes,
        sentToKitchen: true,
        modifiers: { create: modifiers },
      };
    });

    const { discountAmount, total: preDeliveryTotal } = this.computeTotals(
      subtotal,
      dto.discountType as unknown as PrismaDiscountType | undefined,
      dto.discountValue,
      0,
    );
    const deliveryFee =
      orderType === 'DELIVERY'
        ? await this.resolveDeliveryFee(restaurantId, dto.deliveryZoneId)
        : 0;
    const total = preDeliveryTotal + deliveryFee;

    const isDineInWithTable = orderType === 'DINE_IN' && !!dto.tableId;

    const { timezone } = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    const day = restaurantDayKey(timezone, new Date());

    const order = await this.prisma.$transaction(async (tx) => {
      if (isDineInWithTable) {
        const table = await tx.table.findFirst({
          where: { id: dto.tableId, restaurantId },
        });
        if (!table) {
          throw new BadRequestException('Table not found');
        }
      }

      const { lastNumber: orderNumber } = await tx.orderNumberCounter.upsert({
        where: { restaurantId_orderType_day: { restaurantId, orderType, day } },
        create: { restaurantId, orderType, day, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
        select: { lastNumber: true },
      });

      const created = await tx.order.create({
        data: {
          restaurantId,
          orderNumber,
          type: orderType,
          status: dto.items.length > 0 ? 'IN_PROGRESS' : 'PENDING',
          tableId: isDineInWithTable ? dto.tableId : undefined,
          clientId: dto.clientId,
          assignedToId,
          guestCount: dto.guestCount,
          notes: dto.notes,
          discountType: dto.discountType as unknown as
            PrismaDiscountType | undefined,
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
          deliveryZoneId:
            orderType === 'DELIVERY' ? dto.deliveryZoneId : undefined,
          scheduledFor: dto.scheduledFor
            ? new Date(dto.scheduledFor)
            : undefined,
          items: { create: itemsData },
        },
        include: ORDER_INCLUDE,
      });

      if (isDineInWithTable) {
        await tx.table.updateMany({
          where: { id: dto.tableId, restaurantId, status: { not: 'OCCUPIED' } },
          data: { status: 'OCCUPIED' },
        });
      }

      return created;
    });

    const orderWithCode = this.withCode(order);
    this.eventsGateway.emitOrderCreated(restaurantId, orderWithCode);
    if (isDineInWithTable && dto.tableId) {
      this.eventsGateway.emitTableStatusChanged(
        restaurantId,
        dto.tableId,
        TableStatus.OCCUPIED,
      );
    }
    await this.printJobsService.enqueueKitchenTickets(
      restaurantId,
      order.id,
      order.items.map((item) => item.id),
    );
    return orderWithCode;
  }

  async updateStatus(
    restaurantId: string,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderWithCode> {
    await this.findOne(restaurantId, id);
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status as unknown as PrismaOrderStatus },
      include: ORDER_INCLUDE,
    });
    this.eventsGateway.emitOrderUpdated(restaurantId, order.id, order.status);
    return this.withCode(order);
  }

  async checkout(
    restaurantId: string,
    currentUserId: string,
    id: string,
    dto: CheckoutOrderDto,
  ): Promise<OrderWithCode> {
    const order = await this.findOne(restaurantId, id);
    if (order.status === 'COMPLETED' || order.status === 'CANCELED') {
      throw new BadRequestException(
        `Order is already ${order.status.toLowerCase()}`,
      );
    }

    const activeModules =
      await this.subscriptionsService.getActiveModules(restaurantId);
    const cashActive = activeModules.includes(Module.CASH);

    if (!cashActive) {
      const { closed, tableFlippedEmpty } = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.order.update({
            where: { id },
            data: {
              status: 'COMPLETED',
              closedAt: new Date(),
              paymentMethodExt:
                dto.paymentMethodExt as unknown as PrismaPaymentMethodExtended,
            },
            include: ORDER_INCLUDE,
          });
          const tableFlippedEmpty = order.tableId
            ? await this.flipTableEmptyIfNoSiblings(
                tx,
                restaurantId,
                order.tableId,
                id,
              )
            : false;
          return { closed: updated, tableFlippedEmpty };
        },
      );

      this.eventsGateway.emitOrderUpdated(
        restaurantId,
        closed.id,
        closed.status,
      );
      if (tableFlippedEmpty && order.tableId) {
        this.eventsGateway.emitTableStatusChanged(
          restaurantId,
          order.tableId,
          TableStatus.EMPTY,
        );
      }
      await this.printJobsService.enqueueReceipt(restaurantId, closed.id);
      return this.withCode(closed);
    }

    if (!dto.sessionId) {
      throw new BadRequestException(
        'A cash session is required to checkout while the Cash module is active',
      );
    }

    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id: dto.sessionId, cashRegister: { restaurantId } },
    });
    if (!session) {
      throw new NotFoundException('Cash session not found');
    }
    if (session.status !== 'OPEN') {
      throw new BadRequestException(
        'Cannot checkout against a closed cash session',
      );
    }

    const { closed, tableFlippedEmpty } = await this.prisma.$transaction(
      async (tx) => {
        await tx.cashMovement.create({
          data: {
            sessionId: session.id,
            type: 'SALE',
            method:
              dto.paymentMethodExt as unknown as PrismaPaymentMethodExtended,
            amount: order.total,
            description: `Pedido #${order.id}`,
            createdById: currentUserId,
          },
        });

        const updated = await tx.order.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            closedAt: new Date(),
            paymentMethodExt:
              dto.paymentMethodExt as unknown as PrismaPaymentMethodExtended,
          },
          include: ORDER_INCLUDE,
        });

        const tableFlippedEmpty = order.tableId
          ? await this.flipTableEmptyIfNoSiblings(
              tx,
              restaurantId,
              order.tableId,
              id,
            )
          : false;

        return { closed: updated, tableFlippedEmpty };
      },
    );

    this.eventsGateway.emitOrderUpdated(restaurantId, closed.id, closed.status);
    if (tableFlippedEmpty && order.tableId) {
      this.eventsGateway.emitTableStatusChanged(
        restaurantId,
        order.tableId,
        TableStatus.EMPTY,
      );
    }
    await this.printJobsService.enqueueReceipt(restaurantId, closed.id);
    return this.withCode(closed);
  }

  async sendItemsToKitchen(
    restaurantId: string,
    orderId: string,
    dto: SendToKitchenDto,
  ): Promise<void> {
    await this.findOne(restaurantId, orderId);
    await this.prisma.orderItem.updateMany({
      where: { id: { in: dto.itemIds }, orderId },
      data: { sentToKitchen: true },
    });
    await this.printJobsService.enqueueKitchenTickets(
      restaurantId,
      orderId,
      dto.itemIds,
    );
  }

  async addItems(
    restaurantId: string,
    orderId: string,
    dto: AddOrderItemsDto,
  ): Promise<OrderWithCode> {
    const order = await this.findOne(restaurantId, orderId);
    if (order.status === 'COMPLETED' || order.status === 'CANCELED') {
      throw new BadRequestException(
        `No se pueden agregar productos a un pedido ${order.status.toLowerCase()}`,
      );
    }

    const priceType = toPriceType(order.type);
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, restaurantId },
      include: { prices: true },
    });
    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException('One or more products were not found');
    }

    const { result, newItemIds } = await this.prisma.$transaction(
      async (tx) => {
        const newItemIds: string[] = [];
        for (const item of dto.items) {
          const product = products.find(
            (candidate) => candidate.id === item.productId,
          );
          if (!product) {
            throw new BadRequestException(
              `Product ${item.productId} not found`,
            );
          }
          const priceEntry = product.prices.find(
            (price) => price.type === priceType,
          );
          if (!priceEntry) {
            throw new BadRequestException(
              `Product ${product.name} has no price configured for ${priceType}`,
            );
          }
          const unitPrice = item.unitPrice ?? Number(priceEntry.price);
          const totalPrice = unitPrice * item.quantity;

          const created = await tx.orderItem.create({
            data: {
              orderId,
              productId: product.id,
              name: product.name,
              quantity: item.quantity,
              unitPrice,
              totalPrice,
              notes: item.notes,
              sentToKitchen: true,
            },
          });
          newItemIds.push(created.id);
        }

        const allItems = await tx.orderItem.findMany({ where: { orderId } });
        const subtotal = allItems.reduce(
          (sum, orderItem) => sum + Number(orderItem.totalPrice),
          0,
        );
        const { discountAmount, total: preDeliveryTotal } = this.computeTotals(
          subtotal,
          order.discountType,
          order.discountValue ? Number(order.discountValue) : undefined,
          0,
        );
        const total = preDeliveryTotal + Number(order.deliveryFee);

        const result = await tx.order.update({
          where: { id: orderId },
          data: { subtotal, discountAmount, total, status: 'IN_PROGRESS' },
          include: ORDER_INCLUDE,
        });

        return { result, newItemIds };
      },
    );

    await this.printJobsService.enqueueKitchenTickets(
      restaurantId,
      orderId,
      newItemIds,
    );
    this.eventsGateway.emitOrderUpdated(restaurantId, orderId, result.status);
    return this.withCode(result);
  }

  async removeItem(
    restaurantId: string,
    orderId: string,
    itemId: string,
  ): Promise<OrderWithCode> {
    const order = await this.findOne(restaurantId, orderId);
    if (order.status === 'COMPLETED' || order.status === 'CANCELED') {
      throw new BadRequestException(
        `No se pueden editar los productos de un pedido ${order.status.toLowerCase()}`,
      );
    }
    const item = order.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });

      const remaining = await tx.orderItem.findMany({ where: { orderId } });
      const subtotal = remaining.reduce(
        (sum, orderItem) => sum + Number(orderItem.totalPrice),
        0,
      );
      const { discountAmount, total: preDeliveryTotal } = this.computeTotals(
        subtotal,
        order.discountType,
        order.discountValue ? Number(order.discountValue) : undefined,
        0,
      );
      const total = preDeliveryTotal + Number(order.deliveryFee);

      return tx.order.update({
        where: { id: orderId },
        data: { subtotal, discountAmount, total },
        include: ORDER_INCLUDE,
      });
    });

    this.eventsGateway.emitOrderUpdated(restaurantId, orderId, result.status);
    return this.withCode(result);
  }

  async removeEmpty(restaurantId: string, orderId: string): Promise<void> {
    const order = await this.findOne(restaurantId, orderId);
    if (order.status === 'COMPLETED' || order.status === 'CANCELED') {
      throw new BadRequestException(
        'No se puede eliminar un pedido ya cerrado',
      );
    }
    if (order.items.length > 0) {
      throw new BadRequestException(
        'Solo se pueden eliminar pedidos sin productos',
      );
    }

    const tableFlippedEmpty = await this.prisma.$transaction(async (tx) => {
      await tx.order.delete({ where: { id: orderId } });
      if (!order.tableId) return false;

      await this.lockTableRow(tx, restaurantId, order.tableId);

      const stillActive = await this.hasOtherActiveOrders(
        tx,
        restaurantId,
        order.tableId,
        orderId,
      );
      if (stillActive) return false;

      const result = await tx.table.updateMany({
        where: { id: order.tableId, restaurantId, status: 'OCCUPIED' },
        data: { status: 'EMPTY' },
      });
      return result.count > 0;
    });

    this.eventsGateway.emitOrderDeleted(restaurantId, orderId);
    if (tableFlippedEmpty && order.tableId) {
      this.eventsGateway.emitTableStatusChanged(
        restaurantId,
        order.tableId,
        TableStatus.EMPTY,
      );
    }
  }

  async moveToTable(
    restaurantId: string,
    orderId: string,
    dto: MoveOrderTableDto,
  ): Promise<OrderWithCode> {
    const order = await this.findOne(restaurantId, orderId);
    if (order.status === 'COMPLETED' || order.status === 'CANCELED') {
      throw new BadRequestException(
        `No se puede mover un pedido ${order.status.toLowerCase()}`,
      );
    }
    if (order.type !== 'DINE_IN') {
      throw new BadRequestException('Solo se pueden mover pedidos de mesa');
    }
    if (order.tableId === dto.tableId) {
      throw new BadRequestException('El pedido ya está en esa mesa');
    }

    const { result, tableFlippedEmpty } = await this.prisma.$transaction(
      async (tx) => {
        const destination = await tx.table.findFirst({
          where: { id: dto.tableId, restaurantId },
        });
        if (!destination) {
          throw new BadRequestException('Table not found');
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: { tableId: dto.tableId },
          include: ORDER_INCLUDE,
        });

        await tx.table.updateMany({
          where: { id: dto.tableId, restaurantId, status: { not: 'OCCUPIED' } },
          data: { status: 'OCCUPIED' },
        });

        const tableFlippedEmpty = order.tableId
          ? await this.flipTableEmptyIfNoSiblings(
              tx,
              restaurantId,
              order.tableId,
              orderId,
            )
          : false;

        return { result: updated, tableFlippedEmpty };
      },
    );

    this.eventsGateway.emitOrderUpdated(restaurantId, result.id, result.status);
    this.eventsGateway.emitTableStatusChanged(
      restaurantId,
      dto.tableId,
      TableStatus.OCCUPIED,
    );
    if (tableFlippedEmpty && order.tableId) {
      this.eventsGateway.emitTableStatusChanged(
        restaurantId,
        order.tableId,
        TableStatus.EMPTY,
      );
    }
    return this.withCode(result);
  }

  /**
   * Locks the table row for the rest of the transaction so two concurrent "is this the
   * last active order?" checks on the same table can't both read "a sibling is still open"
   * and both skip freeing the table. Must be called before counting siblings, never after.
   */
  private async lockTableRow(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    tableId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${tableId} AND "restaurantId" = ${restaurantId} FOR UPDATE`;
  }

  private async hasOtherActiveOrders(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    tableId: string,
    excludeOrderId: string,
  ): Promise<boolean> {
    const count = await tx.order.count({
      where: {
        tableId,
        restaurantId,
        status: { in: OPEN_ORDER_STATUSES },
        id: { not: excludeOrderId },
      },
    });
    return count > 0;
  }

  private async flipTableEmptyIfNoSiblings(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    tableId: string,
    excludeOrderId: string,
  ): Promise<boolean> {
    await this.lockTableRow(tx, restaurantId, tableId);

    const stillActive = await this.hasOtherActiveOrders(
      tx,
      restaurantId,
      tableId,
      excludeOrderId,
    );
    if (stillActive) return false;

    const result = await tx.table.updateMany({
      where: { id: tableId, restaurantId, status: { not: 'EMPTY' } },
      data: { status: 'EMPTY' },
    });
    return result.count > 0;
  }

  private computeTotals(
    subtotal: number,
    discountType: PrismaDiscountType | null | undefined,
    discountValue: number | null | undefined,
    deliveryFee: number,
  ): { discountAmount: number; total: number } {
    const discountAmount = this.computeDiscount(
      subtotal,
      discountType ?? undefined,
      discountValue ?? undefined,
    );
    const total = Math.max(subtotal - discountAmount, 0) + deliveryFee;
    return { discountAmount, total };
  }

  private computeDiscount(
    subtotal: number,
    type: PrismaDiscountType | undefined,
    value: number | undefined,
  ): number {
    if (!type || !value) return 0;
    if (type === 'PERCENTAGE') return (subtotal * value) / 100;
    return value;
  }

  private async resolveDeliveryFee(
    restaurantId: string,
    deliveryZoneId: string | undefined,
  ): Promise<number> {
    if (deliveryZoneId) {
      const zone = await this.prisma.deliveryZone.findFirst({
        where: {
          id: deliveryZoneId,
          isActive: true,
          deliveryConfig: { restaurantId },
        },
      });
      if (!zone) {
        throw new BadRequestException('Delivery zone not found or inactive');
      }
      return Number(zone.fee);
    }

    const config = await this.prisma.deliveryConfig.findUnique({
      where: { restaurantId },
    });
    return config ? Number(config.deliveryFee) : 0;
  }
}
