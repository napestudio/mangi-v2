import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@mangiar/shared";
import type {
  CashMovementType as PrismaCashMovementType,
  CashRegisterSession as PrismaCashRegisterSession,
} from "../../../generated/prisma/client";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CloseSessionDto } from "./dto/close-session.dto";
import type { OpenSessionDto } from "./dto/open-session.dto";

const SESSION_INCLUDE = {
  movements: { orderBy: { createdAt: "asc" as const } },
  openedBy: { select: { id: true, name: true, username: true } },
  closedBy: { select: { id: true, name: true, username: true } },
  reopenedBy: { select: { id: true, name: true, username: true } },
} as const;

function signedAmount(type: PrismaCashMovementType, amount: number): number {
  if (type === "EXPENSE" || type === "REFUND") return -amount;
  return amount;
}

@Injectable()
export class CashSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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

    const movementsTotal = session.movements.reduce(
      (sum, movement) => sum + signedAmount(movement.type, Number(movement.amount)),
      0,
    );
    const expectedAmount = Number(session.openingAmount) + movementsTotal;
    const variance = dto.closingAmount - expectedAmount;

    return this.prisma.cashRegisterSession.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingAmount: dto.closingAmount,
        expectedAmount,
        variance,
        closedById,
        notes: dto.notes ?? session.notes,
      },
      include: SESSION_INCLUDE,
    });
  }

  async reopen(restaurantId: string, id: string, currentUserId: string) {
    const session = await this.findOne(restaurantId, id);
    if (session.status !== "CLOSED") {
      throw new BadRequestException("Cash session is not closed");
    }

    const reopened = await this.prisma.cashRegisterSession.update({
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
