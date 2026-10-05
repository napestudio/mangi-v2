import { z } from "zod";
import { ReservationStatus } from "../enums";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createTimeSlotSchema = z.object({
  name: z.string().optional(),
  startTime: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  endTime: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  capacity: z.number().int().positive(),
  price: z.number().nonnegative().optional(),
  turnDurationMinutes: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().nonnegative().optional(),
  slotIntervalMinutes: z.number().int().min(5).optional(),
});
export type CreateTimeSlotPayload = z.infer<typeof createTimeSlotSchema>;

export const updateTimeSlotSchema = createTimeSlotSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateTimeSlotPayload = z.infer<typeof updateTimeSlotSchema>;

export const assignTimeSlotTablesSchema = z.object({
  tables: z.array(z.object({ tableId: z.string(), exclusive: z.boolean() })),
});
export type AssignTimeSlotTablesPayload = z.infer<typeof assignTimeSlotTablesSchema>;

export const checkAvailabilitySchema = z.object({
  timeSlotId: z.string(),
  businessDate: z.string(),
  time: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  partySize: z.number().int().positive(),
  tableIds: z.array(z.string()).optional(),
  excludeReservationId: z.string().optional(),
});
export type CheckAvailabilityPayload = z.infer<typeof checkAvailabilitySchema>;

export const createReservationSchema = z.object({
  timeSlotId: z.string(),
  businessDate: z.string(),
  time: z.string().regex(TIME_REGEX, "Formato esperado HH:mm"),
  partySize: z.number().int().positive(),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  accessibilityNeeds: z.string().optional(),
  notes: z.string().optional(),
  clientId: z.string().optional(),
  tableIds: z.array(z.string()).optional(),
});
export type CreateReservationPayload = z.infer<typeof createReservationSchema>;

export const updateReservationSchema = createReservationSchema.partial().extend({
  internalNotes: z.string().optional(),
});
export type UpdateReservationPayload = z.infer<typeof updateReservationSchema>;

export const updateReservationStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
});
export type UpdateReservationStatusPayload = z.infer<typeof updateReservationStatusSchema>;
