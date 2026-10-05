---
name: mangiar-inventory
description: Inventario de Mangiar v2 — ingredientes y stock. Usar al trabajar en ajustes de stock, movimientos de inventario, o unidades de medida (peso/volumen).
---

# Mangiar v2 — Inventario

Gestión de ingredientes y su stock, con historial de movimientos. Módulo `Module.INVENTORY`. Es dependencia de `mangiar-suppliers` (una orden de compra recibida ajusta stock) — no es un módulo aislado. Ver `mangiar-architecture`.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/inventory/`): `ingredients.controller.ts`/`ingredients.service.ts`, `stock.controller.ts`/`stock.service.ts`, `inventory.module.ts`, `dto/create-ingredient.dto.ts`, `dto/update-ingredient.dto.ts`, `dto/adjust-stock.dto.ts`, `dto/set-stock.dto.ts`, `dto/list-stock-movements.dto.ts`.
- **Prisma**: `Ingredient`, `StockMovement`, `Product` (leído/actualizado en transacción cuando el ajuste de stock viene de un producto).
- **Shared**: `packages/shared/src/schemas/inventory.schema.ts`; enums `UnitType`, `WeightUnit`, `VolumeUnit`.
- **Frontend**: `apps/app/src/routes/_app/inventory/ingredients/index.tsx`.
- **Desktop**: ninguno.

## Decisiones y convenciones

- `InventoryModule` exporta `StockService` específicamente para que `SuppliersModule` lo importe (`PurchaseOrdersService.updateStatus()` llama `stockService.adjust(...)` por cada item al marcar una orden como `RECEIVED`) — dirección unidireccional, Inventory no conoce a Suppliers. No invertir esa dependencia.
- Las unidades (`WeightUnit`, `VolumeUnit`) se muestran siempre en español en la UI (ej. "Kilogramo", no "Kilogram") — hay mapas de labels/abreviaturas dedicados en `inventory/ingredients/index.tsx`; si se agrega una unidad nueva al enum, hay que agregarla también a esos mapas o se va a mostrar el valor crudo en inglés.
- `StockMovement` es el historial de auditoría de cambios de stock — cualquier ajuste (manual, por venta, por recepción de compra) debería dejar un registro ahí, no mutar `Ingredient.stock`/`Product.stock` directo sin dejar rastro.

## Limitaciones conocidas

- Ninguna documentada explícitamente — módulo construido en Stage 6 sin reportes de bugs posteriores.
