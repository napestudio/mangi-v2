import { z } from "zod";
import { ExpenseCategory, PaymentMethodExtended } from "../enums";

export const createExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory).optional(),
  description: z.string().min(1),
  vendor: z.string().optional(),
  amount: z.number().positive(),
  paidMethod: z.nativeEnum(PaymentMethodExtended).optional(),
  paidById: z.string().optional(),
  expenseDate: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
  paidFromSessionId: z.string().optional(),
});
export type CreateExpensePayload = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory).optional(),
  description: z.string().min(1).optional(),
  vendor: z.string().optional(),
  amount: z.number().positive().optional(),
  paidMethod: z.nativeEnum(PaymentMethodExtended).optional(),
  paidById: z.string().optional(),
  expenseDate: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateExpensePayload = z.infer<typeof updateExpenseSchema>;
