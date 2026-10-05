---
name: mangiar-printing
description: Impresión de Mangiar v2 — estaciones, impresoras (red/WiFi/USB) y la cola de trabajos de impresión, incluyendo el puente con Electron. Usar al trabajar en tickets de cocina, recibos, o cualquier cosa relacionada a imprimir físicamente.
---

# Mangiar v2 — Impresión

El único módulo que necesariamente toca `apps/desktop` además de `apps/api`/`apps/app` — la impresión física real solo puede pasar en el proceso main de Electron, nunca en un tab de browser puro (sin Electron corriendo en esa máquina, el botón de imprimir no hace nada). Módulo `Module.PRINTING`. **No probado con hardware real todavía.** Ver `mangiar-architecture`.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/printing/`): `stations.controller.ts`/`stations.service.ts`, `printers.controller.ts`/`printers.service.ts`, `print-jobs.controller.ts`/`print-jobs.service.ts`, `printing.module.ts`, `dto/create-station.dto.ts`, `dto/update-station.dto.ts`, `dto/create-printer.dto.ts`, `dto/update-printer.dto.ts`, `dto/update-print-job-status.dto.ts`.
- **Prisma**: `Station`, `StationCategory` (puente a `Category`), `Printer`, `PrintJob`, `Order`/`OrderItem` (leídos para armar el payload).
- **Shared**: `packages/shared/src/schemas/printing.schema.ts`; enums `PrinterConnectionType` (`NETWORK`|`USB`), `PrintMode` (`STATION_ITEMS`|`FULL_ORDER`|`BOTH`), `PrintJobStatus`. `PrinterStatus` vive en Prisma pero no se expuso en la capa Zod.
- **Frontend**: `apps/app/src/routes/_app/settings/printing.tsx`. El listener global del socket `print:job` vive en `apps/app/src/components/layout/AppShell.tsx` (no en una página específica — tiene que funcionar sin importar qué pantalla esté abierta).
- **Desktop**: `apps/desktop/src/main/printing.ts` (lógica real de impresión), `apps/desktop/src/main/ipc-handlers.ts` (registra el handler `print:job`), `apps/desktop/src/preload/index.ts` (expone `window.electron.print.job`), tipos en `apps/app/src/lib/electron.d.ts`.

## Decisiones y convenciones

- **Diseño sin dependencias nativas (cambio respecto al plan original)**: el plan sugería el paquete nativo `printer` para USB, pero requiere compilar con node-gyp y pnpm bloqueó el build (`ERR_PNPM_IGNORED_BUILDS`) — no se aprobó sin pedido explícito del usuario, y no hay garantía de que compile en la máquina real sin build tools de Windows. En su lugar:
  - **Red y WiFi, mismo código** (`PrinterConnectionType.NETWORK`): `node-thermal-printer` puro vía `tcp://ip:port` (puerto 9100 estándar ESC/POS) — WiFi y Ethernet son indistinguibles a nivel de aplicación, ambos son solo TCP, por eso no hay un tercer valor de enum para WiFi.
  - **USB**: impresión silenciosa nativa de Electron (`win.webContents.print({ silent: true, deviceName })`) sobre un ticket HTML renderizado en una `BrowserWindow` oculta, apuntando al nombre de impresora instalada en el sistema (`Printer.usbPath` — documentado en la UI como "nombre de la impresora en el sistema", no se renombró la columna).
  - Ninguna de las dos rutas requiere dependencias nativas nuevas.
- **Multi-estación simultánea desde un mismo pedido**: `PrintJobsService.enqueueKitchenTickets()` agrupa los `OrderItem` por `Product.category → StationCategory → Station → Station.printers`, y crea **un `PrintJob` independiente por impresora** (no uno por pedido). Confirmado en vivo: un pedido con items de "Pastas" (→ estación Cocina) y "Bebidas" (→ estación Barra) genera dos jobs, cada uno solo con sus items, emitidos casi simultáneamente — cada impresora imprime en paralelo sin bloquear a la otra.
- **El recibo (`FULL_ORDER`/`BOTH`) se dispara desde `OrdersService.checkout()`**, no desde Printing — ver `mangiar-orders`. `enqueueReceipt()` manda un job a cada printer activa con ese `printMode`, sin importar si tiene `stationId` o no.
- **Puente Electron**: el evento WS `print:job` (emitido vía `EventsGateway.emitPrintJob`, ya existente desde antes) lleva el `PrintJob` **con la `Printer` completa incluida** (`include: { printer: true }`) — así el proceso main no necesita una llamada HTTP extra para saber a qué IP/nombre de sistema imprimir. El callback de vuelta (`PATCH /print-jobs/:id/status`) usa el `accessToken` del usuario logueado que el renderer le pasa al invocar el IPC — no hay credencial separada para el proceso main.
- **Multi-terminal no resuelto**: si hay dos instancias de Electron abiertas (ej. caja + cocina) y ambas pueden alcanzar la misma impresora de red, hoy el diseño transmite el job a todas por igual — riesgo real de impresión duplicada si ambas lo agarran casi a la vez. Limitación conocida, no un bug a parchear a ciegas; requeriría un mecanismo de asignación terminal↔impresora si se vuelve un problema real.

## Limitaciones conocidas

- **Sin hardware real probado**: todo lo de arriba fue validado con CRUD completo, el escenario multi-estación, y el callback de status — pero nunca contra una impresora física real (ni TCP ni USB). El `width` en caracteres por línea (`charsPerLine`: 42 para 80mm, 32 para 58mm) es una aproximación estándar de industria, no calibrada contra una impresora concreta.
- Multi-terminal (ver arriba).
- No hay reintento automático de un `PrintJob` que quedó `FAILED` — hoy es responsabilidad del usuario notar el error y reimprimir manualmente.
