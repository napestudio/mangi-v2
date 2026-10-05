---
name: mangiar-suppliers
description: Proveedores de Mangiar v2 — proveedores, órdenes de compra y cuenta corriente. Usar al trabajar en órdenes de compra, recepción de mercadería, pagos a proveedores o el ledger de saldo.
---

# Mangiar v2 — Proveedores

Gestión de proveedores, órdenes de compra, y cuenta corriente (ledger de saldo). Módulo `Module.SUPPLIERS`. Depende de `mangiar-inventory` para ajustar stock al recibir una orden. Ver `mangiar-architecture`.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/suppliers/`): `suppliers.controller.ts`/`suppliers.service.ts`, `purchase-orders.controller.ts`/`purchase-orders.service.ts`, `suppliers.module.ts`, `dto/create-supplier.dto.ts`, `dto/update-supplier.dto.ts`, `dto/link-ingredient.dto.ts`, `dto/record-payment.dto.ts`, `dto/create-purchase-order.dto.ts`, `dto/update-purchase-order-status.dto.ts`.
- **Prisma**: `Supplier`, `IngredientSupplier`, `SupplierLedgerEntry`, `PurchaseOrder`, `PurchaseOrderItem` (implícito), `Ingredient`/`Product` (de Inventory/Menú).
- **Shared**: `packages/shared/src/schemas/suppliers.schema.ts`; enum `PurchaseOrderStatus`.
- **Frontend**: `apps/app/src/routes/_app/suppliers/index.tsx`, `apps/app/src/routes/_app/suppliers/purchase-orders.tsx`.
- **Desktop**: ninguno.

## Decisiones y convenciones

- `SuppliersModule` importa `InventoryModule` (no al revés) para inyectar `StockService` — `PurchaseOrdersService.updateStatus()`, al pasar una orden a `RECEIVED`, llama `stockService.adjust(...)` por cada item y por separado transacciona el ledger entry + incremento de `Supplier.balance` + el cambio de status.
- `recordPayment()` crea un `SupplierLedgerEntry` tipo `PAYMENT` y decrementa `Supplier.balance`, **sin** vincularlo todavía a un `CashMovement` real (ver `mangiar-cash` — el campo `cashMovementId` existe pero no está conectado). Si se pide "que el pago a proveedor también salga de la caja", ese es el hilo a retomar.
- `IngredientSupplier` es la tabla puente que permite múltiples proveedores por ingrediente, con `isPreferred`/`lastCost`/`supplierSku` por vínculo — al armar una orden de compra nueva, el precio sugerido debería venir de ahí, no inventarse.

## Limitaciones conocidas

- Pago a proveedor no afecta el arqueo de caja (ver arriba) — gap real, no decisión final.
