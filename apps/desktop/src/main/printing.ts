import { BrowserWindow } from "electron";
import { PrinterTypes, ThermalPrinter } from "node-thermal-printer";

interface PrintJobItem {
  name: string;
  quantity: number;
  notes?: string | null;
  unitPrice?: string;
  totalPrice?: string;
}

interface KitchenPayload {
  type: "kitchen";
  orderId: string;
  items: PrintJobItem[];
}

interface ReceiptPayload {
  type: "receipt";
  orderId: string;
  items: PrintJobItem[];
  subtotal: string;
  discountAmount: string;
  deliveryFee: string;
  total: string;
  paymentMethodExt: string | null;
}

type PrintJobPayloadData = KitchenPayload | ReceiptPayload;

interface PrinterRef {
  id: string;
  name: string;
  connectionType: "NETWORK" | "USB";
  ipAddress: string | null;
  port: number | null;
  usbPath: string | null;
  paperWidth: number;
  headerText: string | null;
  footerText: string | null;
  copies: number;
}

export interface IncomingPrintJob {
  id: string;
  payload: PrintJobPayloadData;
  printer: PrinterRef;
}

const API_BASE_URL = process.env["MANGIAR_API_URL"] ?? "http://localhost:3000";

export async function handlePrintJob(printJob: IncomingPrintJob, accessToken: string | null): Promise<void> {
  try {
    if (printJob.printer.connectionType === "NETWORK") {
      await printNetwork(printJob);
    } else {
      await printUsb(printJob);
    }
    await reportStatus(printJob.id, "CONFIRMED", accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown printing error";
    await reportStatus(printJob.id, "FAILED", accessToken, message);
  }
}

function charsPerLine(paperWidthMm: number): number {
  return paperWidthMm >= 80 ? 42 : 32;
}

async function printNetwork(printJob: IncomingPrintJob): Promise<void> {
  const { printer: printerRef } = printJob;
  if (!printerRef.ipAddress) {
    throw new Error("Printer has no IP address configured");
  }

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${printerRef.ipAddress}:${printerRef.port ?? 9100}`,
    width: charsPerLine(printerRef.paperWidth ?? 80),
  });

  const connected = await printer.isPrinterConnected();
  if (!connected) {
    throw new Error(`Could not connect to printer at ${printerRef.ipAddress}:${printerRef.port ?? 9100}`);
  }

  for (let copy = 0; copy < (printerRef.copies ?? 1); copy++) {
    printer.clear();
    buildTicket(printer, printJob);
    await printer.execute();
  }
}

function buildTicket(printer: ThermalPrinter, printJob: IncomingPrintJob): void {
  const { payload, printer: printerRef } = printJob;

  if (printerRef.headerText) {
    printer.alignCenter();
    printer.bold(true);
    printer.println(printerRef.headerText);
    printer.bold(false);
    printer.drawLine();
  }

  printer.alignLeft();
  if (payload.type === "kitchen") {
    printer.bold(true);
    printer.println("COCINA");
    printer.bold(false);
    for (const item of payload.items) {
      printer.println(`${item.quantity}x ${item.name}`);
      if (item.notes) printer.println(`  ${item.notes}`);
    }
  } else {
    printer.bold(true);
    printer.println("RECIBO");
    printer.bold(false);
    for (const item of payload.items) {
      printer.leftRight(`${item.quantity}x ${item.name}`, `$${item.totalPrice ?? ""}`);
    }
    printer.drawLine();
    printer.leftRight("Subtotal", `$${payload.subtotal}`);
    if (Number(payload.discountAmount) > 0) printer.leftRight("Descuento", `-$${payload.discountAmount}`);
    if (Number(payload.deliveryFee) > 0) printer.leftRight("Envío", `$${payload.deliveryFee}`);
    printer.bold(true);
    printer.leftRight("TOTAL", `$${payload.total}`);
    printer.bold(false);
  }

  if (printerRef.footerText) {
    printer.drawLine();
    printer.alignCenter();
    printer.println(printerRef.footerText);
  }

  printer.cut();
}

async function printUsb(printJob: IncomingPrintJob): Promise<void> {
  const { printer: printerRef } = printJob;
  if (!printerRef.usbPath) {
    throw new Error("Printer has no system printer name configured");
  }

  const html = renderTicketHtml(printJob);
  const win = new BrowserWindow({ show: false });

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    for (let copy = 0; copy < (printerRef.copies ?? 1); copy++) {
      await new Promise<void>((resolve, reject) => {
        win.webContents.print(
          { silent: true, deviceName: printerRef.usbPath ?? undefined, margins: { marginType: "none" } },
          (success, failureReason) => {
            if (success) resolve();
            else reject(new Error(failureReason || "Print failed"));
          },
        );
      });
    }
  } finally {
    win.destroy();
  }
}

function renderTicketHtml(printJob: IncomingPrintJob): string {
  const { payload, printer: printerRef } = printJob;
  const widthMm = printerRef.paperWidth ?? 80;

  const rows =
    payload.type === "kitchen"
      ? payload.items
          .map(
            (item) =>
              `<div>${item.quantity}x ${escapeHtml(item.name)}${item.notes ? `<br/><small>${escapeHtml(item.notes)}</small>` : ""}</div>`,
          )
          .join("")
      : payload.items
          .map(
            (item) =>
              `<div style="display:flex;justify-content:space-between"><span>${item.quantity}x ${escapeHtml(item.name)}</span><span>$${item.totalPrice}</span></div>`,
          )
          .join("") +
        `<hr/><div style="display:flex;justify-content:space-between;font-weight:bold"><span>TOTAL</span><span>$${payload.total}</span></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { width: ${widthMm}mm; font-family: monospace; font-size: 12px; margin: 0; padding: 4px; }
    hr { border: none; border-top: 1px dashed #000; }
  </style></head><body>
    ${printerRef.headerText ? `<div style="text-align:center;font-weight:bold">${escapeHtml(printerRef.headerText)}</div><hr/>` : ""}
    <div style="font-weight:bold">${payload.type === "kitchen" ? "COCINA" : "RECIBO"}</div>
    ${rows}
    ${printerRef.footerText ? `<hr/><div style="text-align:center">${escapeHtml(printerRef.footerText)}</div>` : ""}
  </body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function reportStatus(
  printJobId: string,
  status: "CONFIRMED" | "FAILED",
  accessToken: string | null,
  errorMessage?: string,
): Promise<void> {
  if (!accessToken) return;
  try {
    await fetch(`${API_BASE_URL}/print-jobs/${printJobId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status, errorMessage }),
    });
  } catch {
    // best-effort callback; if this fails the job stays at its last status and can be inspected server-side
  }
}
