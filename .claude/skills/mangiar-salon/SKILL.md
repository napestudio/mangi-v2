---
name: mangiar-salon
description: Salón de Mangiar v2 — mesas, sectores y floor plan. Usar al trabajar en la gestión de mesas, sectores, el editor visual de plano, o el estado en tiempo real de las mesas (ocupada/libre/reservada).
---

# Mangiar v2 — Salón

Gestión de sectores y mesas de un restaurante, incluyendo el editor visual de floor plan y el estado de cada mesa en tiempo real (usado por Caja, Pedidos y Reservas). Módulo `Module.SALON`. Ver `mangiar-architecture` para convenciones transversales y `mangiar-ui-ux` para patrones de pantalla.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/salon/`): `sectors.controller.ts`/`sectors.service.ts`, `tables.controller.ts`/`tables.service.ts`, `salon.module.ts`, `dto/create-sector.dto.ts`, `dto/update-sector.dto.ts`, `dto/create-table.dto.ts`, `dto/update-table.dto.ts`, `dto/update-table-status.dto.ts`, `dto/move-table.dto.ts`.
- **Prisma**: `Sector`, `Table`.
- **Shared**: `packages/shared/src/schemas/salon.schema.ts`; enums `TableShape`, `TableStatus`.
- **Frontend**: `apps/app/src/routes/_app/salon/index.tsx` (vista operativa del día), `apps/app/src/routes/_app/settings/map.tsx` (editor de floor plan — el nombre de archivo es "map" pero es el editor de salón, no tiene nada que ver con delivery).
- **Desktop**: ninguno.

## Decisiones y convenciones

- `TableStatus` (`EMPTY`, `OCCUPIED`, `RESERVED`, `CLEANING`, `PAYING`) se actualiza en tiempo real vía WebSocket: el cliente emite `table:update_status`, `EventsGateway.handleTableUpdateStatus` valida contra `TablesService.updateStatus` y rebroadcastea `table:status_changed` a todos los sockets del restaurante — así que el estado de mesa se sincroniza entre pantallas (caja, salón, pedidos) sin polling.
- El editor de floor plan (`settings/map.tsx`) usa `FloorPlanCanvas` para posicionamiento libre con drag — las coordenadas/forma (`TableShape`) se persisten directo en `Table`, no hay un sistema de grid/snap.
- `Sector` es el agrupador que usan tanto Salón como Caja (`CashRegisterOnSector` vincula una caja a uno o más sectores) — tener esto en cuenta antes de cambiar la forma de `Sector`.

## Limitaciones conocidas

- Ninguna limitación pendiente documentada de este módulo — fue de los primeros construidos (Stage 2) y no recibió reportes de bugs después de la etapa de hardening de Reservas (que sí depende de las mesas de Salón para el table-picker).
