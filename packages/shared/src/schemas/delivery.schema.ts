import { z } from "zod";
import { DeliveryZoneType } from "../enums";

export const updateDeliveryConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  minOrderAmount: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  notes: z.string().optional(),
});
export type UpdateDeliveryConfigPayload = z.infer<typeof updateDeliveryConfigSchema>;

export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(DeliveryZoneType).default(DeliveryZoneType.RADIUS),
  minRadiusMeters: z.number().nonnegative().optional(),
  maxRadiusMeters: z.number().positive().optional(),
  fee: z.number().nonnegative(),
  estimatedMinutes: z.number().int().positive().optional(),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type CreateDeliveryZonePayload = z.infer<typeof createDeliveryZoneSchema>;

export const updateDeliveryZoneSchema = createDeliveryZoneSchema.partial();
export type UpdateDeliveryZonePayload = z.infer<typeof updateDeliveryZoneSchema>;
