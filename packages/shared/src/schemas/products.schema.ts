import { z } from "zod";
import { PriceType, ProductTag, UnitType, VolumeUnit, WeightUnit } from "../enums";

export const productPriceSchema = z.object({
  type: z.nativeEnum(PriceType),
  price: z.number().nonnegative(),
});
export type ProductPricePayload = z.infer<typeof productPriceSchema>;

export const productComponentSchema = z.object({
  componentId: z.string(),
  quantity: z.number().positive(),
});
export type ProductComponentPayload = z.infer<typeof productComponentSchema>;

const createProductBaseSchema = z.object({
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
  stock: z.number().nonnegative().optional(),
  minStock: z.number().nonnegative().optional(),
  maxStock: z.number().nonnegative().optional(),
  tags: z.array(z.nativeEnum(ProductTag)).default([]),
  sortOrder: z.number().int().default(0),
  prices: z.array(productPriceSchema).min(1),
  components: z.array(productComponentSchema).default([]),
});

function validateComponents(data: { isCombo: boolean; components: { componentId: string }[] }, ctx: z.RefinementCtx) {
  if (data.isCombo && data.components.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["components"], message: "Un combo necesita al menos un componente" });
  }
  if (!data.isCombo && data.components.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["components"], message: "Solo un combo puede tener componentes" });
  }
  const ids = data.components.map((c) => c.componentId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["components"], message: "Un componente no puede repetirse" });
  }
}

export const createProductSchema = createProductBaseSchema.superRefine(validateComponents);
export type CreateProductPayload = z.infer<typeof createProductBaseSchema>;

export const updateProductSchema = createProductBaseSchema.partial().superRefine((data, ctx) => {
  if (data.isCombo && data.components && data.components.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["components"], message: "Un combo necesita al menos un componente" });
  }
});
export type UpdateProductPayload = z.infer<typeof updateProductSchema>;
