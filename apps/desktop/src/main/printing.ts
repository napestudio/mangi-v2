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

interface CashMovementEntry {
  type: string;
  method: string;
  amount: string;
}

interface CashMethodCountEntry {
  method: string;
  expectedAmount: string;
  countedAmount: string;
  variance: string;
}

interface CashSessionPayload {
  type: "cash_session";
  registerName: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  openedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  openingAmount: string;
  movements: CashMovementEntry[];
  methodCounts: CashMethodCountEntry[];
  expectedAmount: string | null;
  closingAmount: string | null;
  variance: string | null;
}

type PrintJobPayloadData = KitchenPayload | ReceiptPayload | TestPayload | CashSessionPayload;

// Debe mantenerse en sync con apps/app/src/components/cash/types.ts#MOVEMENT_TYPE_LABELS
// (este paquete no depende de @mangiar/shared).
const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Egreso",
  SALE: "Venta",
  REFUND: "Reembolso",
  CORRECTION: "Ajuste",
};

// Debe mantenerse en sync con apps/app/src/lib/payment-methods.ts#PAYMENT_METHOD_LABELS.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD_DEBIT: "Débito",
  CARD_CREDIT: "Crédito",
  TRANSFER: "Transferencia",
  PAYMENT_LINK: "Link de pago",
  QR_CODE: "QR",
  ACCOUNT: "Cuenta corriente",
};

// Un movimiento de caja "resta" si es EXPENSE o REFUND — debe mantenerse en sync con
// packages/shared/src/utils/cash-arqueo.ts#signedCashMovementAmount.
function isExpenseLikeMovement(type: string): boolean {
  return type === "EXPENSE" || type === "REFUND";
}

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
  } else if (payload.type === "cash_session") {
    printer.alignCenter();
    printer.bold(true);
    printer.println(payload.registerName.toUpperCase());
    printer.bold(false);
    printer.println(payload.status === "OPEN" ? "CAJA ABIERTA" : "ARQUEO DE CAJA");
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Apertura: ${new Date(payload.openedAt).toLocaleString("es-AR")}`);
    if (payload.openedBy) printer.println(`Abrió: ${payload.openedBy}`);
    if (payload.status === "CLOSED") {
      if (payload.closedAt) printer.println(`Cierre: ${new Date(payload.closedAt).toLocaleString("es-AR")}`);
      if (payload.closedBy) printer.println(`Cerró: ${payload.closedBy}`);
    }
    printer.leftRight("Monto de apertura", `$${payload.openingAmount}`);
    printer.drawLine();

    const income = payload.movements.filter((movement) => !isExpenseLikeMovement(movement.type));
    const expenses = payload.movements.filter((movement) => isExpenseLikeMovement(movement.type));
    const movementLine = (movement: CashMovementEntry) =>
      printer.leftRight(
        `${MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type} · ${PAYMENT_METHOD_LABELS[movement.method] ?? movement.method}`,
        `$${movement.amount}`,
      );

    if (payload.movements.length === 0) {
      printer.println("Sin movimientos.");
    } else {
      if (income.length > 0) {
        printer.bold(true);
        printer.println("INGRESOS");
        printer.bold(false);
        income.forEach(movementLine);
      }
      if (expenses.length > 0) {
        printer.bold(true);
        printer.println("EGRESOS");
        printer.bold(false);
        expenses.forEach(movementLine);
      }
    }
    printer.drawLine();

    if (payload.status === "CLOSED" && payload.methodCounts.length > 0) {
      printer.bold(true);
      printer.println("ARQUEO POR MÉTODO");
      printer.bold(false);
      for (const count of payload.methodCounts) {
        printer.println(PAYMENT_METHOD_LABELS[count.method] ?? count.method);
        printer.leftRight("  Esperado", `$${count.expectedAmount}`);
        printer.leftRight("  Contado", `$${count.countedAmount}`);
        printer.leftRight("  Diferencia", `$${count.variance}`);
      }
      printer.drawLine();
    }

    if (payload.status === "CLOSED") {
      printer.leftRight("Esperado", `$${payload.expectedAmount ?? "0"}`);
      printer.leftRight("Contado", `$${payload.closingAmount ?? "0"}`);
      printer.bold(true);
      printer.leftRight("Diferencia", `$${payload.variance ?? "0"}`);
      printer.bold(false);
    }
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

  if (payload.type === "cash_session") {
    const income = payload.movements.filter((movement) => !isExpenseLikeMovement(movement.type));
    const expenses = payload.movements.filter((movement) => isExpenseLikeMovement(movement.type));
    const movementRow = (movement: CashMovementEntry) =>
      `<div style="display:flex;justify-content:space-between"><span>${escapeHtml(MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type)} · ${escapeHtml(PAYMENT_METHOD_LABELS[movement.method] ?? movement.method)}</span><span>$${movement.amount}</span></div>`;
    const methodCountBlock = payload.methodCounts
      .map(
        (count) => `<div style="margin-top:4px"><b>${escapeHtml(PAYMENT_METHOD_LABELS[count.method] ?? count.method)}</b>
          <div style="display:flex;justify-content:space-between"><span>Esperado</span><span>$${count.expectedAmount}</span></div>
          <div style="display:flex;justify-content:space-between"><span>Contado</span><span>$${count.countedAmount}</span></div>
          <div style="display:flex;justify-content:space-between"><span>Diferencia</span><span>$${count.variance}</span></div>
        </div>`,
      )
      .join("");

    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body { width: ${widthMm}mm; font-family: monospace; font-size: 12px; margin: 0; padding: 4px; }
      hr { border: none; border-top: 1px dashed #000; }
    </style></head><body>
      <div style="text-align:center;font-weight:bold">${escapeHtml(payload.registerName.toUpperCase())}</div>
      <div style="text-align:center">${payload.status === "OPEN" ? "CAJA ABIERTA" : "ARQUEO DE CAJA"}</div>
      <hr/>
      <div>Apertura: ${new Date(payload.openedAt).toLocaleString("es-AR")}</div>
      ${payload.openedBy ? `<div>Abrió: ${escapeHtml(payload.openedBy)}</div>` : ""}
      ${payload.status === "CLOSED" && payload.closedAt ? `<div>Cierre: ${new Date(payload.closedAt).toLocaleString("es-AR")}</div>` : ""}
      ${payload.status === "CLOSED" && payload.closedBy ? `<div>Cerró: ${escapeHtml(payload.closedBy)}</div>` : ""}
      <div style="display:flex;justify-content:space-between"><span>Monto de apertura</span><span>$${payload.openingAmount}</span></div>
      <hr/>
      ${payload.movements.length === 0 ? "<div>Sin movimientos.</div>" : ""}
      ${income.length > 0 ? `<div style="font-weight:bold">INGRESOS</div>${income.map(movementRow).join("")}` : ""}
      ${expenses.length > 0 ? `<div style="font-weight:bold;margin-top:4px">EGRESOS</div>${expenses.map(movementRow).join("")}` : ""}
      <hr/>
      ${payload.status === "CLOSED" && payload.methodCounts.length > 0 ? `<div style="font-weight:bold">ARQUEO POR MÉTODO</div>${methodCountBlock}<hr/>` : ""}
      ${
        payload.status === "CLOSED"
          ? `<div style="display:flex;justify-content:space-between"><span>Esperado</span><span>$${payload.expectedAmount ?? "0"}</span></div>
             <div style="display:flex;justify-content:space-between"><span>Contado</span><span>$${payload.closingAmount ?? "0"}</span></div>
             <div style="display:flex;justify-content:space-between;font-weight:bold"><span>Diferencia</span><span>$${payload.variance ?? "0"}</span></div>`
          : ""
      }
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
