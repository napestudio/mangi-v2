import { Injectable, NotFoundException } from "@nestjs/common";
import { buildOrderCode, Module, type OrderType } from "@mangiar/shared";
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

    const [order, items] = await Promise.all([
      this.prisma.order.findFirst({
        where: { id: orderId, restaurantId },
        include: { table: true, client: true, restaurant: { select: { name: true } } },
      }),
      this.prisma.orderItem.findMany({
        where: { id: { in: itemIds }, orderId, order: { restaurantId } },
        include: {
          product: {
            include: {
              category: { include: { stationCategory: { include: { station: { include: { printers: true } } } } } },
            },
          },
        },
      }),
    ]);
    if (!order) return;

    // Contexto del pedido repetido igual en cada comanda (una por impresora/estación) para que la
    // cocina sepa a qué mesa/cliente corresponde sin tener que cruzar con otra pantalla.
    const orderContext = {
      orderCode: buildOrderCode(order.restaurant.name, order.type as unknown as OrderType, order.orderNumber),
      orderType: order.type,
      tableNumber: order.table?.number ?? null,
      customerName: order.client?.name ?? order.deliveryName ?? null,
      deliveryAddress: order.type === "DELIVERY" ? order.deliveryAddress : null,
    };

    const itemsByPrinter = new Map<string, { printerId: string; stationName: string; items: typeof items }>();
    for (const item of items) {
      const stations = item.product.category?.stationCategory.map((entry) => entry.station) ?? [];
      for (const station of stations) {
        for (const printer of station.printers) {
          if (!printer.isActive || printer.printMode === "FULL_ORDER") continue;
          const bucket = itemsByPrinter.get(printer.id) ?? {
            printerId: printer.id,
            stationName: station.name,
            items: [],
          };
          bucket.items.push(item);
          itemsByPrinter.set(printer.id, bucket);
        }
      }
    }

    for (const { printerId, stationName, items: printerItems } of itemsByPrinter.values()) {
      await this.createAndEmit(restaurantId, printerId, {
        type: "kitchen",
        orderId,
        stationName,
        ...orderContext,
        items: printerItems.map((item) => ({ name: item.name, quantity: item.quantity, notes: item.notes })),
      });
    }
  }

  async enqueueReceipt(restaurantId: string, orderId: string): Promise<void> {
    if (!(await this.isPrintingActive(restaurantId))) return;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { items: true, restaurant: { select: { name: true } } },
    });
    if (!order) return;

    const orderCode = buildOrderCode(order.restaurant.name, order.type as unknown as OrderType, order.orderNumber);

    const printers = await this.prisma.printer.findMany({
      where: { restaurantId, isActive: true, printMode: { in: ["FULL_ORDER", "BOTH"] } },
    });

    for (const printer of printers) {
      await this.createAndEmit(restaurantId, printer.id, {
        type: "receipt",
        orderId: order.id,
        orderCode,
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

  async enqueueTestPrint(restaurantId: string, printerId: string): Promise<PrismaPrintJob> {
    const printer = await this.prisma.printer.findFirst({ where: { id: printerId, restaurantId } });
    if (!printer) {
      throw new NotFoundException("Printer not found");
    }
    return this.createAndEmit(restaurantId, printerId, { type: "test" });
  }

  findAllForPrinter(restaurantId: string, printerId: string): Promise<PrismaPrintJob[]> {
    return this.prisma.printJob.findMany({
      where: { printerId, printer: { restaurantId } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async updateStatus(restaurantId: string, id: string, dto: UpdatePrintJobStatusDto): Promise<PrismaPrintJob> {
    const printJob = await this.prisma.printJob.findFirst({
      where: { id, printer: { restaurantId } },
      include: { printer: true },
    });
    if (!printJob) {
      throw new NotFoundException("Print job not found");
    }

    const updated = await this.prisma.printJob.update({
      where: { id },
      data: {
        status: dto.status,
        errorMessage: dto.errorMessage,
        attempts: { increment: 1 },
        lastAttempt: new Date(),
        confirmedAt: dto.status === "CONFIRMED" ? new Date() : undefined,
      },
    });

    // La prueba de impresión es la única acción de la UI que espera una respuesta de "¿la impresora
    // anda?" en tiempo real, así que es el único caso donde un resultado de PrintJob retroalimenta
    // Printer.status — un ticket de cocina/recibo normal no lo toca (ver mangiar-printing SKILL.md).
    const payload = printJob.payload as { type?: string; stationName?: string; orderCode?: string } | null;
    if (payload?.type === "test" && (dto.status === "CONFIRMED" || dto.status === "FAILED")) {
      await this.prisma.printer.update({
        where: { id: printJob.printerId },
        data: { status: dto.status === "CONFIRMED" ? "ONLINE" : "ERROR" },
      });
    }

    // Un ticket de cocina/recibo real que falla era 100% silencioso hasta ahora — el mozo no tiene
    // forma de saber que no salió, y puede no estar cerca de la impresora para notar el problema a
    // simple vista. Avisamos por socket a cualquier pantalla conectada del restaurante (la prueba de
    // impresión no entra acá: ya tiene su propio aviso vía polling en el frontend).
    if (dto.status === "FAILED" && (payload?.type === "kitchen" || payload?.type === "receipt")) {
      const what = payload.type === "kitchen" ? `la comanda de ${payload.stationName ?? "cocina"}` : "el recibo";
      const order = payload.orderCode ? ` (${payload.orderCode})` : "";
      const reason = dto.errorMessage ? ` — ${dto.errorMessage}` : "";
      this.eventsGateway.emitPrintJobFailed(restaurantId, {
        message: `No se pudo imprimir ${what}${order} en "${printJob.printer.name}"${reason}`,
      });
    }

    return updated;
  }

  private async createAndEmit(
    restaurantId: string,
    printerId: string,
    payload: Record<string, unknown>,
  ): Promise<PrismaPrintJob> {
    const printJob = await this.prisma.printJob.create({
      data: { printerId, payload: payload as unknown as Prisma.InputJsonValue },
      include: { printer: true },
    });
    this.eventsGateway.emitPrintJob(restaurantId, printJob);
    return printJob;
  }

  private async isPrintingActive(restaurantId: string): Promise<boolean> {
    const activeModules = await this.subscriptionsService.getActiveModules(restaurantId);
    return activeModules.includes(Module.PRINTING);
  }
}
