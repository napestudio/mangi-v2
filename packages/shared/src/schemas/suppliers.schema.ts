import { z } from "zod";
import { PurchaseOrderStatus } from "../enums";

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateSupplierPayload = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateSupplierPayload = z.infer<typeof updateSupplierSchema>;

export const linkIngredientSchema = z.object({
  ingredientId: z.string(),
  supplierSku: z.string().optional(),
  lastCost: z.number().nonnegative().optional(),
  isPreferred: z.boolean().optional(),
});
export type LinkIngredientPayload = z.infer<typeof linkIngredientSchema>;

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
});
export type RecordPaymentPayload = z.infer<typeof recordPaymentSchema>;

export const purchaseOrderItemSchema = z.object({
  productId: z.string().optional(),
  ingredientId: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
});
export type PurchaseOrderItemPayload = z.infer<typeof purchaseOrderItemSchema>;

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string(),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1),
});
export type CreatePurchaseOrderPayload = z.infer<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.nativeEnum(PurchaseOrderStatus),
});
export type UpdatePurchaseOrderStatusPayload = z.infer<typeof updatePurchaseOrderStatusSchema>;
