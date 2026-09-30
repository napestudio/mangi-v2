import { z } from "zod";
import { TableShape, TableStatus } from "../enums";

export const createSectorSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  canvasWidth: z.number().positive().optional(),
  canvasHeight: z.number().positive().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateSectorPayload = z.infer<typeof createSectorSchema>;

export const updateSectorSchema = createSectorSchema.partial();
export type UpdateSectorPayload = z.infer<typeof updateSectorSchema>;

export const createTableSchema = z.object({
  sectorId: z.string(),
  number: z.string().min(1),
  capacity: z.number().int().positive(),
  shape: z.nativeEnum(TableShape).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotation: z.number().optional(),
});
export type CreateTablePayload = z.infer<typeof createTableSchema>;

export const updateTableSchema = createTableSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateTablePayload = z.infer<typeof updateTableSchema>;

export const moveTableSchema = z.object({
  posX: z.number(),
  posY: z.number(),
  rotation: z.number().optional(),
});
export type MoveTablePayload = z.infer<typeof moveTableSchema>;

export const updateTableStatusSchema = z.object({
  status: z.nativeEnum(TableStatus),
});
export type UpdateTableStatusPayload = z.infer<typeof updateTableStatusSchema>;
