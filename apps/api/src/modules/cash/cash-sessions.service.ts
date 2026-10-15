import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, computeExpectedByMethod } from "@mangiar/shared";
import type { CashRegisterSession as PrismaCashRegisterSession, PrintJob as PrismaPrintJob } from "../../../generated/prisma/client";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { PrintJobsService } from "../printing/print-jobs.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CloseSessionDto } from "./dto/close-session.dto";
import type { OpenSessionDto } from "./dto/open-session.dto";

const SESSION_INCLUDE = {
  movements: { orderBy: { createdAt: "asc" as const } },
  methodCounts: true,
  openedBy: { select: { id: true, name: true, username: true } },
  closedBy: { select: { id: true, name: true, username: true } },
  reopenedBy: { select: { id: true, name: true, username: true } },
} as const;

@Injectable()
export class CashSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly printJobsService: PrintJobsService,
  ) {}

  print(restaurantId: string, id: string, printerId: string): Promise<PrismaPrintJob> {
    return this.printJobsService.enqueueCashSessionPrint(restaurantId, id, printerId);
  }

  async findAllForRegister(restaurantId: string, cashRegisterId: string): Promise<PrismaCashRegisterSession[]> {
    await this.requireRegister(restaurantId, cashRegisterId);
    return this.prisma.cashRegisterSession.findMany({
      where: { cashRegisterId },
      include: SESSION_INCLUDE,
      orderBy: { openedAt: "desc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id, cashRegister: { restaurantId } },
      include: SESSION_INCLUDE,
    });
    if (!session) {
      throw new NotFoundException("Cash session not found");
    }
    return session;
  }

  async open(restaurantId: string, cashRegisterId: string, currentUserId: string, dto: OpenSessionDto) {
    await this.requireRegister(restaurantId, cashRegisterId);

    const existingOpen = await this.prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, status: "OPEN" },
    });
    if (existingOpen) {
      throw new BadRequestException("This cash register already has an open session");
    }

    const openedById = await this.resolveStaffId(restaurantId, dto.openedById, currentUserId);

    return this.prisma.cashRegisterSession.create({
      data: {
        cashRegisterId,
        openingAmount: dto.openingAmount,
        notes: dto.notes,
        openedById,
      },
      include: SESSION_INCLUDE,
    });
  }

  async close(restaurantId: string, id: string, currentUserId: string, dto: CloseSessionDto) {
    const session = await this.findOne(restaurantId, id);
    if (session.status !== "OPEN") {
      throw new BadRequestException("Cash session is not open");
    }

    const closedById = await this.resolveStaffId(restaurantId, dto.closedById, currentUserId);

    const expectedByMethod = computeExpectedByMethod(
      Number(session.openingAmount),
      session.movements.map((movement) => ({
        type: movement.type,
        method: movement.method,
        amount: Number(movement.amount),
      })),
    );

    const expectedMethods = new Set(Object.keys(expectedByMethod));
    const countedMethods = new Set(dto.counts.map((count) => count.method as string));
    const missing = [...expectedMethods].filter((method) => !countedMethods.has(method));
    const unexpected = [...countedMethods].filter((method) => !expectedMethods.has(method));
    if (missing.length > 0 || unexpected.length > 0) {
      const details = [
        missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
        unexpected.length > 0 ? `unexpected: ${unexpected.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      throw new BadRequestException(`Counts must cover exactly the payment methods with movements (${details})`);
    }

    const methodCounts = dto.counts.map((count) => {
      const expectedAmount = expectedByMethod[count.method] ?? 0;
      return {
        method: count.method,
        expectedAmount,
        countedAmount: count.countedAmount,
        variance: count.countedAmount - expectedAmount,
      };
    });

    const expectedAmount = methodCounts.reduce((sum, entry) => sum + entry.expectedAmount, 0);
    const closingAmount = methodCounts.reduce((sum, entry) => sum + entry.countedAmount, 0);
    const variance = closingAmount - expectedAmount;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.cashSessionMethodCount.createMany({
        data: methodCounts.map((entry) => ({
          sessionId: id,
          method: entry.method,
          expectedAmount: entry.expectedAmount,
          countedAmount: entry.countedAmount,
          variance: entry.variance,
        })),
      });

      return tx.cashRegisterSession.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closingAmount,
          expectedAmount,
          variance,
          closedById,
          notes: dto.notes ?? session.notes,
        },
        include: SESSION_INCLUDE,
      });
    });

    await this.auditLog.record({
      restaurantId,
      actorId: currentUserId,
      action: AuditAction.CASH_SESSION_CLOSED,
      entityType: "CashRegisterSession",
      entityId: id,
      metadata: { cashRegisterId: session.cashRegisterId, expectedAmount, closingAmount, variance, methodCounts },
    });

    return updated;
  }

  async reopen(restaurantId: string, id: string, currentUserId: string) {
    const session = await this.findOne(restaurantId, id);
    if (session.status !== "CLOSED") {
      throw new BadRequestException("Cash session is not closed");
    }

    const reopened = await this.prisma.$transaction(async (tx) => {
      await tx.cashSessionMethodCount.deleteMany({ where: { sessionId: id } });

      return tx.cashRegisterSession.update({
        where: { id },
        data: {
          status: "OPEN",
          closedAt: null,
          closingAmount: null,
          expectedAmount: null,
          variance: null,
          reopenedAt: new Date(),
          reopenedById: currentUserId,
        },
        include: SESSION_INCLUDE,
      });
    });

    await this.auditLog.record({
      restaurantId,
      actorId: currentUserId,
      action: AuditAction.CASH_SESSION_REOPENED,
      entityType: "CashRegisterSession",
      entityId: id,
      metadata: {
        cashRegisterId: session.cashRegisterId,
        previousClosingAmount: session.closingAmount?.toString() ?? null,
        previousExpectedAmount: session.expectedAmount?.toString() ?? null,
        previousVariance: session.variance?.toString() ?? null,
        previousClosedAt: session.closedAt,
      },
    });

    return reopened;
  }

  private async requireRegister(restaurantId: string, cashRegisterId: string): Promise<void> {
    const register = await this.prisma.cashRegister.findFirst({ where: { id: cashRegisterId, restaurantId } });
    if (!register) {
      throw new NotFoundException("Cash register not found");
    }
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
