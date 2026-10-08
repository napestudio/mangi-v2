import { connect as netConnect } from "net";
import { BrowserWindow } from "electron";
import { PrinterTypes, ThermalPrinter } from "node-thermal-printer";

interface PrintJobItem {
  name: string;
  quantity: number;
  notes?: string | null;
  unitPrice?: string;
  totalPrice?: string;
}

type KitchenOrderType = "DINE_IN" | "TAKE_AWAY" | "DELIVERY" | "COUNTER";

interface KitchenPayload {
  type: "kitchen";
  orderId: string;
  stationName: string;
  orderCode: string;
  orderType: KitchenOrderType;
  tableNumber: string | null;
  customerName: string | null;
  deliveryAddress: string | null;
  items: PrintJobItem[];
}

interface ReceiptPayload {
  type: "receipt";
  orderId: string;
  orderCode: string;
  items: PrintJobItem[];
  subtotal: string;
  discountAmount: string;
  deliveryFee: string;
  total: string;
  paymentMethodExt: string | null;
}

interface TestPayload {
  type: "test";
}

type PrintJobPayloadData = KitchenPayload | ReceiptPayload | TestPayload;

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

// Debe mantenerse en sync con packages/shared/src/utils/printer-paper.ts#getCharsPerLine
// (este paquete no depende de @mangiar/shared).
function charsPerLine(paperWidthMm: number): number {
  return paperWidthMm >= 80 ? 48 : 32;
}

async function printNetwork(printJob: IncomingPrintJob): Promise<void> {
  const { printer: printerRef } = printJob;
  if (!printerRef.ipAddress) {
    throw new Error("Printer has no IP address configured");
  }
  const port = printerRef.port ?? 9100;

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${printerRef.ipAddress}:${port}`,
    width: charsPerLine(printerRef.paperWidth ?? 80),
  });

  const connected = await printer.isPrinterConnected();
  if (!connected) {
    throw new Error(`Could not connect to printer at ${printerRef.ipAddress}:${port}`);
  }

  for (let copy = 0; copy < (printerRef.copies ?? 1); copy++) {
    printer.clear();
    buildTicket(printer, printJob);
    const buffer = printer.getBuffer();
    if (!buffer) continue;
    // No usamos `printer.execute()` a propósito: la librería escribe el buffer y cierra la
    // conexión con `socket.destroy()` apenas el write local termina, sin esperar a que la
    // impresora lo haya leído — si estuvo inactiva un rato y su stack de red está "despertando",
    // eso trunca el ticket en silencio y el job igual queda CONFIRMED. `sendBufferToNetworkPrinter`
    // hace un cierre prolijo (`socket.end()` + esperar `close`) para no perder datos en ese caso.
    // Ver mangiar-printing SKILL.md.
    await sendBufferToNetworkPrinter(printerRef.ipAddress, port, buffer);
  }
}

function sendBufferToNetworkPrinter(host: string, port: number, buffer: Buffer, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = netConnect({ host, port, timeout: timeoutMs });
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.on("connect", () => {
      socket.write(buffer, (writeError) => {
        if (writeError) {
          finish(writeError instanceof Error ? writeError : new Error(String(writeError)));
          return;
        }
        socket.end();
      });
    });

    socket.on("close", () => finish());
    socket.on("error", (error) => finish(error));
    socket.on("timeout", () => finish(new Error(`Socket timeout writing to ${host}:${port}`)));
  });
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
    printer.alignCenter();
    printer.bold(true);
    printer.println(payload.stationName.toUpperCase());
    printer.bold(false);
    printer.setTypeFontB();
    printer.println(new Date().toLocaleString("es-AR"));
    printer.setTypeFontA();
    printer.drawLine();

    printer.alignLeft();
    printer.bold(true);
    printer.println(payload.orderCode);
    printer.bold(false);
    printer.println(kitchenOrderContextLine(payload));
    printer.drawLine();

    for (const item of payload.items) {
      printer.println(`${item.quantity}x ${item.name}`);
      if (item.notes) printer.println(`  ${item.notes}`);
    }
  } else if (payload.type === "receipt") {
    printer.bold(true);
    printer.println("RECIBO");
    printer.println(payload.orderCode);
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
  } else {
    const width = charsPerLine(printerRef.paperWidth ?? 80);
    printer.alignCenter();
    printer.bold(true);
    printer.println("PRUEBA DE IMPRESIÓN");
    printer.bold(false);
    printer.alignLeft();
    printer.println(printerRef.name);
    printer.println(new Date().toLocaleString("es-AR"));
    printer.println(`Papel: ${printerRef.paperWidth ?? 80}mm · ${width} caracteres/línea`);
    printer.drawLine();
    printer.println("x".repeat(width));
    printer.drawLine();
    printer.println("Si ves esta línea completa y alineada, la impresora está bien configurada.");
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

  if (payload.type === "test") {
    const chars = charsPerLine(widthMm);
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body { width: ${widthMm}mm; font-family: monospace; font-size: 12px; margin: 0; padding: 4px; }
      hr { border: none; border-top: 1px dashed #000; }
    </style></head><body>
      <div style="text-align:center;font-weight:bold">PRUEBA DE IMPRESIÓN</div>
      <div>${escapeHtml(printerRef.name)}</div>
      <div>${new Date().toLocaleString("es-AR")}</div>
      <div>Papel: ${widthMm}mm · ${chars} caracteres/línea</div>
      <hr/>
      <div style="word-break:break-all">${"x".repeat(chars)}</div>
      <hr/>
      <div>Si ves esta línea completa y alineada, la impresora está bien configurada.</div>
    </body></html>`;
  }

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

  const kitchenHeader =
    payload.type === "kitchen"
      ? `<div style="text-align:center;font-weight:bold">${escapeHtml(payload.stationName.toUpperCase())}</div>
         <div style="text-align:center;font-size:9px;color:#444">${new Date().toLocaleString("es-AR")}</div>
         <hr/>
         <div style="font-weight:bold">${escapeHtml(payload.orderCode)}</div>
         <div>${escapeHtml(kitchenOrderContextLine(payload))}</div>`
      : `<div style="font-weight:bold">RECIBO</div><div>${escapeHtml(payload.orderCode)}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { width: ${widthMm}mm; font-family: monospace; font-size: 12px; margin: 0; padding: 4px; }
    hr { border: none; border-top: 1px dashed #000; }
  </style></head><body>
    ${printerRef.headerText ? `<div style="text-align:center;font-weight:bold">${escapeHtml(printerRef.headerText)}</div><hr/>` : ""}
    ${kitchenHeader}
    ${rows}
    ${printerRef.footerText ? `<hr/><div style="text-align:center">${escapeHtml(printerRef.footerText)}</div>` : ""}
  </body></html>`;
}

/** Línea de contexto propia del tipo de pedido — lo que la cocina necesita para saber a qué
 * mesa/cliente corresponde la comanda sin cruzar con otra pantalla. Compartida entre el ticket
 * ESC/POS (buildTicket) y el fallback HTML de USB (renderTicketHtml). */
function kitchenOrderContextLine(payload: KitchenPayload): string {
  switch (payload.orderType) {
    case "DINE_IN":
      return payload.tableNumber ? `Mesa ${payload.tableNumber}` : "Mesa sin asignar";
    case "TAKE_AWAY":
      return payload.customerName ? `Para llevar · ${payload.customerName}` : "Para llevar";
    case "DELIVERY":
      return [payload.customerName, payload.deliveryAddress].filter((part): part is string => Boolean(part)).join(" · ") || "Delivery";
    case "COUNTER":
      return "Mostrador";
    default:
      return "";
  }
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
