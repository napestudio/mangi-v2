import { z } from "zod";
import { CashMovementType, PaymentMethodExtended } from "../enums";

export const createCashRegisterSchema = z.object({
  name: z.string().min(1),
  sectorIds: z.array(z.string()).optional(),
});
export type CreateCashRegisterPayload = z.infer<typeof createCashRegisterSchema>;

export const updateCashRegisterSchema = createCashRegisterSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCashRegisterPayload = z.infer<typeof updateCashRegisterSchema>;

export const openSessionSchema = z.object({
  openingAmount: z.number().nonnegative(),
  openedById: z.string().optional(),
  notes: z.string().optional(),
});
export type OpenSessionPayload = z.infer<typeof openSessionSchema>;

export const closeSessionSchema = z.object({
  closingAmount: z.number().nonnegative(),
  closedById: z.string().optional(),
  notes: z.string().optional(),
});
export type CloseSessionPayload = z.infer<typeof closeSessionSchema>;

export const createMovementSchema = z.object({
  type: z.nativeEnum(CashMovementType),
  method: z.nativeEnum(PaymentMethodExtended).optional(),
  amount: z.number().nonnegative(),
  description: z.string().optional(),
  reference: z.string().optional(),
  createdById: z.string().optional(),
});
export type CreateMovementPayload = z.infer<typeof createMovementSchema>;
