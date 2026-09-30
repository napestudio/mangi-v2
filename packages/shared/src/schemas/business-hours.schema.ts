import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const businessHoursRowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  closeTime: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  label: z.string().optional(),
});
export type BusinessHoursRow = z.infer<typeof businessHoursRowSchema>;

export const upsertBusinessHoursSchema = z.object({
  rows: z.array(businessHoursRowSchema).min(1).max(7),
});
export type UpsertBusinessHoursPayload = z.infer<typeof upsertBusinessHoursSchema>;

export const businessHoursStatusSchema = z.object({
  isOpen: z.boolean(),
  today: businessHoursRowSchema.nullable(),
  nextChange: z.string().nullable(),
});
export type BusinessHoursStatus = z.infer<typeof businessHoursStatusSchema>;
