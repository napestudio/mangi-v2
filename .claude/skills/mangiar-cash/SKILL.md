---
name: mangiar-cash
description: Caja de Mangiar v2 — cajas registradoras, sesiones (apertura/cierre), movimientos y arqueo. Usar al trabajar en cálculo de montos esperados, apertura/cierre de sesión, o cualquier flujo que registre un CashMovement.
---

# Mangiar v2 — Caja

Multi-caja con sesiones de apertura/cierre y arqueo. Es el módulo del que más otros módulos dependen (Expenses, Orders/POS, Suppliers lo referencian para registrar movimientos). Módulo `Module.CASH`. Ver `mangiar-architecture` para convenciones transversales.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/cash/`): `cash-registers.controller.ts`/`cash-registers.service.ts`, `cash-sessions.controller.ts`/`cash-sessions.service.ts`, `cash-movements.controller.ts`/`cash-movements.service.ts`, `cash.module.ts`, `dto/create-cash-register.dto.ts`, `dto/update-cash-register.dto.ts`, `dto/open-session.dto.ts`, `dto/close-session.dto.ts`, `dto/create-movement.dto.ts`.
- **Prisma**: `CashRegister`, `CashRegisterOnSector`, `CashRegisterSession`, `CashMovement`.
- **Shared**: `packages/shared/src/schemas/cash.schema.ts`; enums `CashMovementType`, `PaymentMethodExtended`.
- **Frontend**: `apps/app/src/routes/_app/cash/index.tsx`.
- **Desktop**: ninguno.

## Decisiones y convenciones

- **`signedAmount`** (`cash-sessions.service.ts`): al cerrar una sesión, `expectedAmount = openingAmount + Σ signedAmount(movement)`, donde `EXPENSE` y `REFUND` restan y el resto (`INCOME`, `SALE`, `CORRECTION`) suma. Cualquier módulo nuevo que cree un `CashMovement` (Expenses, Orders/POS checkout) debe elegir el `type` correcto para que esta suma salga bien — no hay validación cruzada que lo detecte si se usa el type equivocado.
- Reabrir una sesión cerrada (`reopen()`, solo rol `ADMIN`) resetea `closingAmount`/`expectedAmount`/`variance` a `null` y registra `reopenedAt`/`reopenedById` — y ahora también un `AuditLog` (`CASH_SESSION_REOPENED`, ver `mangiar-architecture`). Esto es intencional: es el mecanismo para poder editar/borrar un gasto vinculado a una sesión ya cerrada (ver `mangiar-expenses`), no un flujo aislado de Caja.
- `recordPayment()` en Suppliers crea un `SupplierLedgerEntry` directo, **sin** pasar por `CashMovement` todavía — el campo `SupplierLedgerEntry.cashMovementId` existe en el schema (agregado cuando se construyó Expenses) pero no está conectado en el código; es un gap real, no una decisión final.
- Staff-attribution: `openedById`/`closedById`/`reopenedById`/`createdById` (en movimientos) resuelven a `currentUserId` por default, overridable con `<StaffPicker>` (ver `mangiar-ui-ux`), validado server-side contra el restaurante.

## Limitaciones conocidas

- **Entrada manual de movimientos pendiente**: el formulario manual de alta de `CashMovement` se sacó deliberadamente de `/cash` en algún momento de la sesión; no hay todavía un flujo de UI para registrar un ingreso/egreso manual fuera de los que generan otros módulos automáticamente (Expenses, Orders checkout). Si el usuario pide esto, es trabajo nuevo, no un bug.
- `SupplierLedgerEntry.cashMovementId` sin conectar (ver arriba) — conectar `recordPayment()` para que un pago a proveedor también afecte el arqueo de caja sería una mejora real, no solo un nice-to-have.
