import { z } from "zod";

export const issuerConditionSchema = z.enum(["responsable_inscripto", "monotributo", "exento", "no_alcanzado"]);
export type IssuerConditionPayload = z.infer<typeof issuerConditionSchema>;

export const fiscalEnvironmentSchema = z.enum(["testing", "production"]);
export type FiscalEnvironmentPayload = z.infer<typeof fiscalEnvironmentSchema>;

export const updateFiscalConfigSchema = z.object({
  cuit: z.string().optional(),
  businessName: z.string().optional(),
  certificate: z.string().optional(),
  privateKey: z.string().optional(),
  salesPointNumber: z.number().int().positive().optional(),
  issuerCondition: issuerConditionSchema.optional(),
  environment: fiscalEnvironmentSchema.optional(),
  autoIssue: z.boolean().optional(),
});
export type UpdateFiscalConfigPayload = z.infer<typeof updateFiscalConfigSchema>;
