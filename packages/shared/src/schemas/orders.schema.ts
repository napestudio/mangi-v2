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

const createOrderBaseSchema = z.object({
  type: z.nativeEnum(OrderType).default(OrderType.DINE_IN),
  tableId: z.string().optional(),
  clientId: z.string().optional(),
  assignedToId: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  notes: z.string().optional(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().nonnegative().optional(),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryPhone: z.string().optional(),
  deliveryName: z.string().optional(),
  deliveryZoneId: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  needsInvoice: z.boolean().default(false),
});

export const createOrderSchema = createOrderBaseSchema.superRefine((data, ctx) => {
  if (data.type === OrderType.COUNTER && data.tableId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tableId"], message: "Un pedido de mostrador no puede tener mesa asignada" });
  }
  if (data.type === OrderType.DELIVERY && !data.deliveryAddress) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryAddress"], message: "La dirección de entrega es obligatoria" });
  }
});
export type CreateOrderPayload = z.infer<typeof createOrderBaseSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});
export type UpdateOrderStatusPayload = z.infer<typeof updateOrderStatusSchema>;

export const payOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paymentMethodExt: z.nativeEnum(PaymentMethodExtended).optional(),
});
export type PayOrderPayload = z.infer<typeof payOrderSchema>;

export const checkoutOrderSchema = z.object({
  paymentMethodExt: z.nativeEnum(PaymentMethodExtended),
  sessionId: z.string().optional(),
});
export type CheckoutOrderPayload = z.infer<typeof checkoutOrderSchema>;
