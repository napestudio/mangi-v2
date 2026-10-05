---
name: mangiar-expenses
description: Gastos (non-sale expenses) de Mangiar v2 — gastos independientes o vinculados a una sesión de caja. Usar al trabajar en el alta de gastos, su vínculo opcional con Caja, o el guard de sesión cerrada.
---

# Mangiar v2 — Gastos

Gastos no asociados a una venta (alquiler, sueldos, insumos, etc.), opcionalmente descontados de una sesión de caja abierta. Módulo `Module.EXPENSES`, deliberadamente separado de `Module.CASH` — un restaurante puede comprar Gastos sin haber comprado el módulo de Caja (en ese caso, todo gasto es independiente, nunca se le exige sesión). Ver `mangiar-architecture` para el patrón `AuditLog` que este módulo usa extensivamente.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/expenses/`): `expenses.controller.ts`/`expenses.service.ts`, `expenses.module.ts`, `dto/create-expense.dto.ts`, `dto/update-expense.dto.ts`, `dto/list-expenses.dto.ts`.
- **Prisma**: `Expense`, `CashRegisterSession`, `CashMovement`, `User`.
- **Shared**: `packages/shared/src/schemas/expenses.schema.ts`; enums `ExpenseCategory`, `PaymentMethodExtended`.
- **Frontend**: `apps/app/src/routes/_app/expenses/index.tsx`.
- **Desktop**: ninguno.

## Decisiones y convenciones

- **Creación** (`ExpensesService.create`): si viene `paidFromSessionId`, valida `Module.CASH` activo + la sesión pertenece al restaurante + está `OPEN`, y crea `CashMovement(type: EXPENSE)` + `Expense` en una transacción. Si no viene `paidFromSessionId`, el gasto es standalone — no exige ni valida nada de Caja, sin importar si CASH está activo o no.
- **Guard de inmutabilidad de sesión cerrada**: editar o borrar un `Expense` que tiene `cashMovementId` chequea el status de la sesión vinculada (`assertLinkedSessionIsOpen`) y rechaza con 400 si está `CLOSED` — el flujo correcto para corregir ese gasto es reabrir la sesión (`mangiar-cash`, solo ADMIN), editar/borrar, y volver a cerrar (lo que recalcula `expectedAmount` desde cero). Esto es intencional, no un bug a "arreglar" sacando el guard.
- **AuditLog**: editar o borrar un `Expense` vinculado a caja queda registrado (`EXPENSE_UPDATED`/`EXPENSE_DELETED`, con snapshot de "antes") — ver `mangiar-architecture` para el patrón completo y cómo extenderlo.
- Borrar un `Expense` con `cashMovementId` borra también el `CashMovement` asociado en la misma transacción (no deja movimientos huérfanos).

## Limitaciones conocidas

- Borrar un gasto vinculado a una sesión **ya cerrada** (vía el flujo reopen→delete→reclose) deja el historial de movimientos de esa sesión reconstruido desde cero al recerrarla — es el comportamiento esperado (expectedAmount se recalcula), pero no hay un registro explícito de "este expectedAmount cambió post-cierre original" más allá del AuditLog del reopen. No es un bug, pero vale tenerlo en cuenta si se pide trazabilidad más fina del arqueo histórico.
