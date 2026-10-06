---
name: mangiar-salon
description: Salón de Mangiar v2 — mesas, sectores y floor plan. Usar al trabajar en la gestión de mesas, sectores, el editor visual de plano, o el estado en tiempo real de las mesas (ocupada/libre/reservada).
---

# Mangiar v2 — Salón

Gestión de sectores y mesas de un restaurante, incluyendo el editor visual de floor plan y el estado de cada mesa en tiempo real (usado por Caja, Pedidos y Reservas). Módulo `Module.SALON`. Ver `mangiar-architecture` para convenciones transversales y `mangiar-ui-ux` para patrones de pantalla.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/salon/`): `sectors.controller.ts`/`sectors.service.ts`, `tables.controller.ts`/`tables.service.ts`, `salon.module.ts`, `dto/create-sector.dto.ts`, `dto/update-sector.dto.ts`, `dto/create-table.dto.ts`, `dto/update-table.dto.ts`, `dto/update-table-status.dto.ts`, `dto/move-table.dto.ts` (reposicionar una mesa en el plano — no confundir con mover un *pedido* de mesa, eso vive en `mangiar-orders`).
- **Prisma**: `Sector`, `Table`.
- **Shared**: `packages/shared/src/schemas/salon.schema.ts`; enums `TableShape`, `TableStatus`.
- **Frontend — vista operativa** (`apps/app/src/routes/_app/salon/index.tsx` + `apps/app/src/components/salon/`): `index.tsx` orquesta sectores/plano/`SidePanel`; `FloorPlanCanvas.tsx` dibuja el plano y exporta `STATUS_STYLES` (el mapa de color por `TableStatus`, reusado por el selector de mesa destino); `tableCache.ts` expone `patchTableStatus(queryClient, tableId, status)` — parchea TODAS las queries `["tables", ...]` cacheadas (la del sector actual y la `"all"`) en un solo lugar, usarlo en vez de parchear una key puntual. El resto de componentes de esta carpeta (`OpenTableForm`, `ActiveOrderPanel`, `OrderDetailPanel`, `MoveOrderTablePicker`, `ProductSearchCombobox`, `NoteEditor`, `CloseTableCheckout`) implementan el flujo de pedido por mesa — ver `mangiar-orders` para los endpoints que consumen.
- **Frontend — editor de plano**: `apps/app/src/routes/_app/settings/map.tsx` (el nombre de archivo es "map" pero es el editor de salón, no tiene nada que ver con delivery).
- **Desktop**: ninguno.

## Decisiones y convenciones

- `TableStatus` (`EMPTY`, `OCCUPIED`, `RESERVED`, `CLEANING`, `PAYING`) se actualiza en tiempo real vía WebSocket: el cliente emite `table:update_status`, `EventsGateway.handleTableUpdateStatus` valida contra `TablesService.updateStatus` y rebroadcastea `table:status_changed` a todos los sockets del restaurante — así que el estado de mesa se sincroniza entre pantallas (caja, salón, pedidos) sin polling. `EventsGateway.emitTableStatusChanged` es el mismo evento/payload disparado también desde `OrdersService` (abrir/cerrar/mover un pedido) — el listener del cliente no distingue el origen, por eso alcanza con un solo `handleStatusChanged` en `salon/index.tsx`.
- El editor de floor plan (`settings/map.tsx`) usa `FloorPlanCanvas` para posicionamiento libre con drag — las coordenadas/forma (`TableShape`) se persisten directo en `Table`, no hay un sistema de grid/snap.
- `Sector` es el agrupador que usan tanto Salón como Caja (`CashRegisterOnSector` vincula una caja a uno o más sectores) — tener esto en cuenta antes de cambiar la forma de `Sector`.
- **Una mesa puede tener varios pedidos activos a la vez** (mesas compartidas) — el panel de mesa (`ActiveOrderPanel`) nunca asume "un pedido por mesa": pide `GET /orders?tableId=&status=PENDING,IN_PROGRESS` y renderiza una "pill" por pedido activo + una pill "+ Nueva orden" (reusa `OpenTableForm` apuntando a la misma mesa, ya ocupada). Ver `mangiar-orders` para las reglas de cuándo una mesa vuelve a `EMPTY`.
- **Mover un pedido de mesa**: ícono en `OrderDetailPanel` abre `MoveOrderTablePicker` (grilla de mesas de TODO el restaurante — `GET /tables` sin `sectorId`, agrupadas por sector, coloreadas con `STATUS_STYLES`). Mesa destino libre → mueve directo; ocupada/reservada/etc. → sub-vista de confirmación inline antes de ejecutar (nunca un modal nuevo, mismo patrón de "reemplazar el cuerpo del panel" que ya usa `CloseTableCheckout`). Al confirmar, dispara un toast (ver `mangiar-toast`) — no hay paso de confirmación en el backend, es puramente UX de cliente.
- **Borrar una mesa está bloqueado si tiene pedidos activos**: `TablesService.remove()` cuenta pedidos `PENDING`/`IN_PROGRESS` con ese `tableId` y lanza `ConflictException` antes de intentar el `delete` (también atrapa `P2003` si hay reservas asociadas). El editor de plano (`settings/map.tsx`) pide confirmación inline (`confirmingDeleteTable`, sin modal) y muestra el error vía `useToast()` si el borrado falla.
- **Reutilizar el toast existente**: cualquier feedback transitorio (éxito/error) de este módulo pasa por `useToast()` (`apps/app/src/components/ui/toast.tsx`) — no crear un mecanismo de notificación paralelo. Ver `mangiar-toast`.
- **`CloseTableCheckout` preselecciona la caja según el sector de la mesa**: pide `GET /tables/:id` con el `tableId` del pedido para resolver su `sectorId`, y entre las cajas con sesión abierta (`openSessions`, ya filtradas) busca la primera cuya lista de sectores (`CashRegisterOnSector`, ver `mangiar-cash`) incluya ese `sectorId` — si encuentra una, precarga el `<select>` con esa sesión (el usuario igual puede cambiarla a mano). Sin sector asignado a ninguna caja abierta, el combo queda en blanco como antes. Es un `useEffect` guardado por `if (sessionId) return`, así que solo autoselecciona una vez por apertura del panel, nunca pisa una elección manual posterior.

## Limitaciones conocidas

- Una mesa marcada `OCCUPIED` por Reservas (al pasar una reserva a `SEATED`) sin que exista todavía un pedido es un estado real y alcanzable — `ActiveOrderPanel` lo resuelve cayendo a `OpenTableForm` si `GET /orders?tableId=...` devuelve un array vacío, en vez de romper o mostrar un panel vacío.
- `ActiveOrderPanel` escucha `order:created/updated/deleted` mientras está montado para no quedar desactualizado si otro dispositivo toca la misma mesa, pero `updated`/`deleted` no vienen con `tableId` en el payload — el listener refetchea sin filtrar en esos dos casos (ver el detalle en `mangiar-orders`). No es gratis, pero el volumen de eventos por restaurante es bajo.
