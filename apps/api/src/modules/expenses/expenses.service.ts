import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@mangiar/shared";
import type { Expense as PrismaExpense } from "../../../generated/prisma/client";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateExpenseDto } from "./dto/create-expense.dto";
import type { ListExpensesDto } from "./dto/list-expenses.dto";
import type { UpdateExpenseDto } from "./dto/update-expense.dto";

const EXPENSE_INCLUDE = {
  paidBy: { select: { id: true, name: true, username: true } },
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

  async create(restaurantId: string, currentUserId: string, dto: CreateExpenseDto): Promise<PrismaExpense> {
    const paidById = await this.resolveStaffId(restaurantId, dto.paidById, currentUserId);

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

  async update(restaurantId: string, actorId: string, id: string, dto: UpdateExpenseDto): Promise<PrismaExpense> {
    const expense = await this.findOne(restaurantId, id);

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

    await this.auditLog.record({
      restaurantId,
      actorId,
      action: AuditAction.EXPENSE_UPDATED,
      entityType: "Expense",
      entityId: id,
      metadata: {
        before: { description: expense.description, amount: expense.amount.toString(), category: expense.category },
        changes: dto,
      },
    });

    return updated;
  }

  async remove(restaurantId: string, actorId: string, id: string): Promise<void> {
    const expense = await this.findOne(restaurantId, id);

    await this.auditLog.record({
      restaurantId,
      actorId,
      action: AuditAction.EXPENSE_DELETED,
      entityType: "Expense",
      entityId: id,
      metadata: {
        description: expense.description,
        amount: expense.amount.toString(),
        category: expense.category,
      },
    });

    await this.prisma.expense.delete({ where: { id } });
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
