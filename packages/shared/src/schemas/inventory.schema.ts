import { z } from "zod";
import { UnitType, VolumeUnit, WeightUnit } from "../enums";

export const createIngredientSchema = z.object({
  name: z.string().min(1),
  unitType: z.nativeEnum(UnitType).optional(),
  weightUnit: z.nativeEnum(WeightUnit).optional(),
  volumeUnit: z.nativeEnum(VolumeUnit).optional(),
  costPerUnit: z.number().nonnegative().optional(),
  minStock: z.number().nonnegative().optional(),
});
export type CreateIngredientPayload = z.infer<typeof createIngredientSchema>;

export const updateIngredientSchema = createIngredientSchema.partial();
export type UpdateIngredientPayload = z.infer<typeof updateIngredientSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().optional(),
  ingredientId: z.string().optional(),
  delta: z.number(),
  reason: z.string().min(1),
  notes: z.string().optional(),
  reference: z.string().optional(),
  attributedToId: z.string().optional(),
});
export type AdjustStockPayload = z.infer<typeof adjustStockSchema>;

export const setStockSchema = z.object({
  productId: z.string().optional(),
  ingredientId: z.string().optional(),
  stock: z.number().nonnegative(),
  reason: z.string().min(1),
  notes: z.string().optional(),
  reference: z.string().optional(),
  attributedToId: z.string().optional(),
});
export type SetStockPayload = z.infer<typeof setStockSchema>;
