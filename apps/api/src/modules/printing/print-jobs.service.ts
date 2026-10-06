import { Injectable, NotFoundException } from "@nestjs/common";
import { Module } from "@mangiar/shared";
import type { Prisma, PrintJob as PrismaPrintJob } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { EventsGateway } from "../websockets/events.gateway";
import type { UpdatePrintJobStatusDto } from "./dto/update-print-job-status.dto";

@Injectable()
export class PrintJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async enqueueKitchenTickets(restaurantId: string, orderId: string, itemIds: string[]): Promise<void> {
    if (!(await this.isPrintingActive(restaurantId)) || itemIds.length === 0) return;

    const items = await this.prisma.orderItem.findMany({
      where: { id: { in: itemIds }, orderId, order: { restaurantId } },
      include: {
        product: {
          include: {
            category: { include: { stationCategory: { include: { station: { include: { printers: true } } } } } },
          },
        },
      },
    });

    const itemsByPrinter = new Map<string, { printerId: string; items: typeof items }>();
    for (const item of items) {
      const stations = item.product.category?.stationCategory.map((entry) => entry.station) ?? [];
      for (const station of stations) {
        for (const printer of station.printers) {
          if (!printer.isActive || printer.printMode === "FULL_ORDER") continue;
          const bucket = itemsByPrinter.get(printer.id) ?? { printerId: printer.id, items: [] };
          bucket.items.push(item);
          itemsByPrinter.set(printer.id, bucket);
        }
      }
    }

    for (const { printerId, items: printerItems } of itemsByPrinter.values()) {
      await this.createAndEmit(restaurantId, printerId, {
        type: "kitchen",
        orderId,
        items: printerItems.map((item) => ({ name: item.name, quantity: item.quantity, notes: item.notes })),
      });
    }
  }

  async enqueueReceipt(restaurantId: string, orderId: string): Promise<void> {
    if (!(await this.isPrintingActive(restaurantId))) return;

    const order = await this.prisma.order.findFirst({ where: { id: orderId, restaurantId }, include: { items: true } });
    if (!order) return;

    const printers = await this.prisma.printer.findMany({
      where: { restaurantId, isActive: true, printMode: { in: ["FULL_ORDER", "BOTH"] } },
    });

    for (const printer of printers) {
      await this.createAndEmit(restaurantId, printer.id, {
        type: "receipt",
        orderId: order.id,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
        })),
        subtotal: order.subtotal.toString(),
        discountAmount: order.discountAmount.toString(),
        deliveryFee: order.deliveryFee.toString(),
        total: order.total.toString(),
        paymentMethodExt: order.paymentMethodExt,
      });
    }
  }

  findAllForPrinter(restaurantId: string, printerId: string): Promise<PrismaPrintJob[]> {
    return this.prisma.printJob.findMany({
      where: { printerId, printer: { restaurantId } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdatePrintJobStatusDto): Promise<PrismaPrintJob> {
    const printJob = await this.prisma.printJob.findFirst({ where: { id, printer: { restaurantId } } });
    if (!printJob) {
      throw new NotFoundException("Print job not found");
    }

    return this.prisma.printJob.update({
      where: { id },
      data: {
        status: dto.status,
        errorMessage: dto.errorMessage,
        attempts: { increment: 1 },
        lastAttempt: new Date(),
        confirmedAt: dto.status === "CONFIRMED" ? new Date() : undefined,
      },
    });
  }

  private async createAndEmit(
    restaurantId: string,
    printerId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const printJob = await this.prisma.printJob.create({
      data: { printerId, payload: payload as unknown as Prisma.InputJsonValue },
      include: { printer: true },
    });
    this.eventsGateway.emitPrintJob(restaurantId, printJob);
  }

  private async isPrintingActive(restaurantId: string): Promise<boolean> {
    const activeModules = await this.subscriptionsService.getActiveModules(restaurantId);
    return activeModules.includes(Module.PRINTING);
  }
}
