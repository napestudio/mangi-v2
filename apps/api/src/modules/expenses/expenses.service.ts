import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Module } from "@mangiar/shared";
import type { Expense as PrismaExpense } from "../../../generated/prisma/client";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateExpenseDto } from "./dto/create-expense.dto";
import type { ListExpensesDto } from "./dto/list-expenses.dto";
import type { UpdateExpenseDto } from "./dto/update-expense.dto";

const EXPENSE_INCLUDE = {
  paidBy: { select: { id: true, name: true, username: true } },
  cashMovement: { select: { id: true, sessionId: true } },
} as const;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll(restaurantId: string, query: ListExpensesDto) {
    return this.prisma.expense.findMany({
      where: {
        restaurantId,
        category: query.category,
        expenseDate: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      include: EXPENSE_INCLUDE,
      orderBy: { expenseDate: "desc" },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, restaurantId }, include: EXPENSE_INCLUDE });
    if (!expense) {
      throw new NotFoundException("Expense not found");
    }
    return expense;
  }

  async create(restaurantId: string, currentUserId: string, activeModules: Module[], dto: CreateExpenseDto): Promise<PrismaExpense> {
    const paidById = await this.resolveStaffId(restaurantId, dto.paidById, currentUserId);

    if (!dto.paidFromSessionId) {
      return this.prisma.expense.create({
        data: {
          restaurantId,
          category: dto.category,
          description: dto.description,
          vendor: dto.vendor,
          amount: dto.amount,
          paidMethod: dto.paidMethod,
          paidById,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
          receiptUrl: dto.receiptUrl,
          notes: dto.notes,
        },
        include: EXPENSE_INCLUDE,
      });
    }

    if (!activeModules.includes(Module.CASH)) {
      throw new BadRequestException("The Cash module is not active for this restaurant");
    }

    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id: dto.paidFromSessionId, cashRegister: { restaurantId } },
    });
    if (!session) {
      throw new NotFoundException("Cash session not found");
    }
    if (session.status !== "OPEN") {
      throw new BadRequestException("Cannot link an expense to a closed cash session");
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          type: "EXPENSE",
          method: dto.paidMethod,
          amount: dto.amount,
          description: dto.description,
          createdById: paidById,
        },
      });

      return tx.expense.create({
        data: {
          restaurantId,
          category: dto.category,
          description: dto.description,
          vendor: dto.vendor,
          amount: dto.amount,
          paidMethod: dto.paidMethod,
          paidById,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
          receiptUrl: dto.receiptUrl,
          notes: dto.notes,
          cashMovementId: movement.id,
        },
        include: EXPENSE_INCLUDE,
      });
    });
  }

  async update(restaurantId: string, actorId: string, id: string, dto: UpdateExpenseDto): Promise<PrismaExpense> {
    const expense = await this.findOne(restaurantId, id);
    if (expense.cashMovementId) {
      await this.assertLinkedSessionIsOpen(expense.cashMovementId);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description,
        vendor: dto.vendor,
        amount: dto.amount,
        paidMethod: dto.paidMethod,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        receiptUrl: dto.receiptUrl,
        notes: dto.notes,
      },
      include: EXPENSE_INCLUDE,
    });

    if (expense.cashMovementId) {
      await this.auditLog.record({
        restaurantId,
        actorId,
        action: AuditAction.EXPENSE_UPDATED,
        entityType: "Expense",
        entityId: id,
        metadata: {
          sessionId: expense.cashMovement?.sessionId,
          before: { description: expense.description, amount: expense.amount.toString(), category: expense.category },
          changes: dto,
        },
      });
    }

    return updated;
  }

  async remove(restaurantId: string, actorId: string, id: string): Promise<void> {
    const expense = await this.findOne(restaurantId, id);
    if (expense.cashMovementId) {
      await this.assertLinkedSessionIsOpen(expense.cashMovementId);

      await this.auditLog.record({
        restaurantId,
        actorId,
        action: AuditAction.EXPENSE_DELETED,
        entityType: "Expense",
        entityId: id,
        metadata: {
          sessionId: expense.cashMovement?.sessionId,
          description: expense.description,
          amount: expense.amount.toString(),
          category: expense.category,
        },
      });

      await this.prisma.$transaction([
        this.prisma.expense.delete({ where: { id } }),
        this.prisma.cashMovement.delete({ where: { id: expense.cashMovementId } }),
      ]);
      return;
    }
    await this.prisma.expense.delete({ where: { id } });
  }

  private async assertLinkedSessionIsOpen(cashMovementId: string): Promise<void> {
    const movement = await this.prisma.cashMovement.findUnique({
      where: { id: cashMovementId },
      select: { session: { select: { status: true } } },
    });
    if (movement?.session.status === "CLOSED") {
      throw new BadRequestException("Cannot modify an expense linked to a closed cash session. Reopen the session first.");
    }
  }

  private async resolveStaffId(restaurantId: string, staffId: string | undefined, currentUserId: string): Promise<string> {
    if (!staffId) return currentUserId;
    const staff = await this.prisma.user.findFirst({ where: { id: staffId, restaurantId } });
    if (!staff) {
      throw new BadRequestException("Selected staff user not found");
    }
    return staffId;
  }
}
