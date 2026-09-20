import { z } from "zod";
import { PriceType, ProductTag, UnitType, VolumeUnit, WeightUnit } from "../enums";

export const productPriceSchema = z.object({
  type: z.nativeEnum(PriceType),
  price: z.number().nonnegative(),
});
export type ProductPricePayload = z.infer<typeof productPriceSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  image: z.string().url().optional(),
  sku: z.string().optional(),
  categoryId: z.string().optional(),
  unitType: z.nativeEnum(UnitType).default(UnitType.UNIT),
  weightUnit: z.nativeEnum(WeightUnit).optional(),
  volumeUnit: z.nativeEnum(VolumeUnit).optional(),
  isActive: z.boolean().default(true),
  isCombo: z.boolean().default(false),
  trackStock: z.boolean().default(false),
  minStock: z.number().nonnegative().optional(),
  maxStock: z.number().nonnegative().optional(),
  tags: z.array(z.nativeEnum(ProductTag)).default([]),
  sortOrder: z.number().int().default(0),
  prices: z.array(productPriceSchema).min(1),
});
export type CreateProductPayload = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductPayload = z.infer<typeof updateProductSchema>;
