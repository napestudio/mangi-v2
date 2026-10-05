import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { IssuerCondition, Receiver, VoucherAmounts } from "facturas";
import type { Invoice as PrismaInvoice, Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ArcaClientFactory } from "./arca-client.factory";
import { FiscalConfigService } from "./fiscal-config.service";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalConfigService: FiscalConfigService,
    private readonly arcaClientFactory: ArcaClientFactory,
  ) {}

  findAll(restaurantId: string): Promise<PrismaInvoice[]> {
    return this.prisma.invoice.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" } });
  }

  async findOne(restaurantId: string, id: string): Promise<PrismaInvoice> {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, restaurantId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  async createForOrder(restaurantId: string, orderId: string): Promise<PrismaInvoice> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { client: true },
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (!order.needsInvoice) {
      throw new BadRequestException("This order was not marked as requiring an invoice");
    }
    if (order.status !== "COMPLETED") {
      throw new BadRequestException("Only completed orders can be invoiced");
    }

    const existing = await this.prisma.invoice.findFirst({
      where: { orderId, status: { in: ["PENDING", "EMITTED"] } },
    });
    if (existing) {
      throw new BadRequestException("This order already has an invoice");
    }

    const fiscalConfig = await this.fiscalConfigService.requireForRestaurant(restaurantId);
    const { describeVoucherType, ARCA_INVOICE_CLASS_BY_ISSUER, toArcaSafeErrorMetadata } = await import("facturas");
    const arca = await this.arcaClientFactory.create(fiscalConfig);

    const issuerCondition = fiscalConfig.issuerCondition as IssuerCondition;
    const totalMinorUnits = Math.round(Number(order.total) * 100);

    const amounts: VoucherAmounts =
      issuerCondition === "responsable_inscripto"
        ? (() => {
            const net = Math.round(totalMinorUnits / 1.21);
            return { net, vat: totalMinorUnits - net };
          })()
        : { net: totalMinorUnits, vat: 0 };

    const to: Receiver = order.client?.taxId
      ? { condition: "responsable_inscripto", cuit: order.client.taxId }
      : { condition: "consumidor_final" };

    const baseData = {
      restaurantId,
      orderId,
      subtotal: amounts.net / 100,
      vatAmount: amounts.vat / 100,
      total: Number(order.total),
      clientName: order.client?.name,
      clientTaxId: order.client?.taxId,
    };

    try {
      const outcome = await arca.issue({
        issuer: issuerCondition,
        salesPoint: fiscalConfig.salesPointNumber,
        to,
        amounts,
      });

      if (outcome.kind === "authorized") {
        const { voucher } = outcome;
        return this.prisma.invoice.create({
          data: {
            ...baseData,
            status: "EMITTED",
            invoiceType: voucher.voucherClass,
            invoiceNumber: voucher.number,
            salesPoint: voucher.salesPoint,
            cae: voucher.cae,
            caeExpiry: new Date(voucher.caeExpiry),
            qrData: voucher.qr,
            arcaResponse: toJsonValue(outcome),
            issuedAt: new Date(),
          },
        });
      }

      const { attempted } = outcome;
      return this.prisma.invoice.create({
        data: {
          ...baseData,
          status: "FAILED",
          invoiceType: describeVoucherType(attempted.voucherType).voucherClass,
          invoiceNumber: attempted.number,
          salesPoint: attempted.salesPoint,
          arcaResponse: toJsonValue(outcome),
        },
      });
    } catch (error) {
      const receiverCondition = to.condition as keyof (typeof ARCA_INVOICE_CLASS_BY_ISSUER)[IssuerCondition];
      const fallbackClass = ARCA_INVOICE_CLASS_BY_ISSUER[issuerCondition]?.[receiverCondition] ?? "C";
      return this.prisma.invoice.create({
        data: {
          ...baseData,
          status: "FAILED",
          invoiceType: fallbackClass,
          invoiceNumber: 0,
          salesPoint: fiscalConfig.salesPointNumber,
          arcaResponse: toJsonValue(toArcaSafeErrorMetadata(error)),
        },
      });
    }
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
