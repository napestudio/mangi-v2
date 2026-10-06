import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const businessHoursShiftSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  closeTime: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  label: z.string().nullable().optional(),
});
export type BusinessHoursShift = z.infer<typeof businessHoursShiftSchema>;

export const upsertBusinessHoursSchema = z.object({
  shifts: z.array(businessHoursShiftSchema).max(56),
});
export type UpsertBusinessHoursPayload = z.infer<typeof upsertBusinessHoursSchema>;

export const businessHoursStatusSchema = z.object({
  isOpen: z.boolean(),
  activeShift: businessHoursShiftSchema.nullable(),
  todayShifts: z.array(businessHoursShiftSchema),
  nextChange: z.string().nullable(),
});
export type BusinessHoursStatus = z.infer<typeof businessHoursStatusSchema>;
