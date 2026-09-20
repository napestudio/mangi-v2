import { z } from "zod";
import { DiscountType, OrderStatus, OrderType, PaymentMethod, PaymentMethodExtended } from "../enums";

export const orderItemModifierSchema = z.object({
  optionId: z.string(),
});
export type OrderItemModifierPayload = z.infer<typeof orderItemModifierSchema>;

export const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
  modifiers: z.array(orderItemModifierSchema).default([]),
});
export type OrderItemPayload = z.infer<typeof orderItemSchema>;

export const createOrderSchema = z.object({
  type: z.nativeEnum(OrderType).default(OrderType.DINE_IN),
  tableId: z.string().optional(),
  clientId: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  notes: z.string().optional(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().nonnegative().optional(),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryPhone: z.string().optional(),
  deliveryName: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  needsInvoice: z.boolean().default(false),
});
export type CreateOrderPayload = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});
export type UpdateOrderStatusPayload = z.infer<typeof updateOrderStatusSchema>;

export const payOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paymentMethodExt: z.nativeEnum(PaymentMethodExtended).optional(),
});
export type PayOrderPayload = z.infer<typeof payOrderSchema>;
