import { z } from "zod";
import { PrinterConnectionType, PrintJobStatus, PrintMode } from "../enums";

export const createStationSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
});
export type CreateStationPayload = z.infer<typeof createStationSchema>;

export const updateStationSchema = createStationSchema.partial();
export type UpdateStationPayload = z.infer<typeof updateStationSchema>;

export const createPrinterSchema = z
  .object({
    name: z.string().min(1),
    connectionType: z.nativeEnum(PrinterConnectionType).default(PrinterConnectionType.NETWORK),
    ipAddress: z.string().optional(),
    port: z.number().int().positive().optional(),
    usbPath: z.string().optional(),
    paperWidth: z.number().int().positive().default(80),
    printMode: z.nativeEnum(PrintMode).default(PrintMode.FULL_ORDER),
    headerText: z.string().optional(),
    footerText: z.string().optional(),
    copies: z.number().int().positive().default(1),
    stationId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.connectionType === PrinterConnectionType.NETWORK && !data.ipAddress) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ipAddress"], message: "La IP es obligatoria para impresoras de red" });
    }
    if (data.connectionType === PrinterConnectionType.USB && !data.usbPath) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["usbPath"], message: "El nombre de la impresora en el sistema es obligatorio" });
    }
  });
export type CreatePrinterPayload = z.infer<typeof createPrinterSchema>;

export const updatePrinterSchema = z.object({
  name: z.string().min(1).optional(),
  connectionType: z.nativeEnum(PrinterConnectionType).optional(),
  ipAddress: z.string().optional(),
  port: z.number().int().positive().optional(),
  usbPath: z.string().optional(),
  paperWidth: z.number().int().positive().optional(),
  printMode: z.nativeEnum(PrintMode).optional(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  copies: z.number().int().positive().optional(),
  stationId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePrinterPayload = z.infer<typeof updatePrinterSchema>;

export const updatePrintJobStatusSchema = z.object({
  status: z.nativeEnum(PrintJobStatus),
  errorMessage: z.string().optional(),
});
export type UpdatePrintJobStatusPayload = z.infer<typeof updatePrintJobStatusSchema>;
