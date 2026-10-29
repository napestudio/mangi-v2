---
name: mangiar-expenses
description: Gastos (non-sale expenses) de Mangiar v2 — siempre independientes de Caja. Usar al trabajar en el alta de gastos o su categorización.
---

# Mangiar v2 — Gastos

Gastos no asociados a una venta (alquiler, sueldos, insumos, etc.). Módulo `Module.EXPENSES`, totalmente independiente de `Module.CASH` — un restaurante puede comprar Gastos sin haber comprado el módulo de Caja, y ningún gasto afecta nunca el arqueo de una caja. Ver `mangiar-architecture` para el patrón `AuditLog` que este módulo usa.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/expenses/`): `expenses.controller.ts`/`expenses.service.ts`, `expenses.module.ts`, `dto/create-expense.dto.ts`, `dto/update-expense.dto.ts`, `dto/list-expenses.dto.ts`.
- **Prisma**: `Expense`, `User`.
- **Shared**: `packages/shared/src/schemas/expenses.schema.ts`; enums `ExpenseCategory`, `PaymentMethodExtended`.
- **Frontend**: `apps/app/src/routes/_app/expenses/index.tsx`.
- **Desktop**: ninguno.

## Decisiones y convenciones

- **Gastos y Caja están desacoplados a propósito (pedido explícito del usuario, 2026)**: hasta esta decisión, un gasto podía opcionalmente "descontarse" de una sesión de caja abierta (creaba un `CashMovement`, y el gasto llevaba `cashMovementId`). Se sacó por completo — `Expense` ya no tiene ninguna relación con `CashRegisterSession`/`CashMovement` (columna `cashMovementId` eliminada por migración), `CreateExpenseDto` ya no acepta `paidFromSessionId`, y el formulario de alta en `/expenses` no tiene ningún campo de caja. La razón del usuario: un Gasto es un registro contable (alquiler, sueldos, insumos) que no representa necesariamente plata física saliendo de una caja registradora — eso es un concepto distinto, ver `mangiar-cash` → "movimientos manuales". Si se necesita registrar que una caja perdió dinero por pagar algo, el flujo correcto es un movimiento manual tipo Egreso en `/cash/movements`, no un Gasto.
- **AuditLog**: editar o borrar un `Expense` queda registrado siempre ahora (`EXPENSE_UPDATED`/`EXPENSE_DELETED`, con snapshot de "antes") — antes solo se auditaba si el gasto estaba vinculado a una caja; al sacar ese vínculo, la auditoría pasó a ser incondicional (coherente con el roadmap de "auditar todo lo posible", ver `mangiar-architecture`).
- Ya no existe el guard de "sesión cerrada" (`assertLinkedSessionIsOpen`) ni el flujo reopen→editar→recerrar para corregir un gasto — un `Expense` se edita/borra libremente en cualquier momento, sin ninguna dependencia de Caja.

## Limitaciones conocidas

- Ninguna conocida relacionada a Caja — ver `mangiar-cash` si lo que se busca es trazabilidad de movimientos de efectivo/otros métodos en una caja específica.
