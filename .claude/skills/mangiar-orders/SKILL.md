---
name: mangiar-orders
description: Pedidos y POS de Mangiar v2 — creación de pedidos, checkout, y la pantalla de venta rápida de mostrador. Usar al trabajar en el flujo de pedidos, el cálculo de totales, el checkout, o la pantalla de venta rápida (/pos/counter).
---

# Mangiar v2 — Pedidos y POS

Módulo CORE (sin gate propio) del que dependen opcionalmente Caja, Delivery, Fiscal e Impresión en pasos puntuales del flujo. Incluye tanto el alta de pedidos tradicional como la pantalla de venta rápida de mostrador. Ver `mangiar-architecture` para el patrón de degradación graceful que este módulo ejemplifica mejor que ningún otro.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/orders/`): `orders.controller.ts`/`orders.service.ts`, `orders.module.ts`, `dto/create-order.dto.ts`, `dto/checkout-order.dto.ts`, `dto/update-order-status.dto.ts`, `dto/send-to-kitchen.dto.ts`.
- **Prisma**: `Order`, `OrderItem`, `Product`, `ModifierOption`, `User`, `DeliveryZone`/`DeliveryConfig` (Delivery), `CashRegisterSession`/`CashMovement` (Caja, creados en `tx` en el checkout).
- **Shared**: `packages/shared/src/schemas/orders.schema.ts`; enums `OrderType`, `OrderStatus`, `DiscountType`, `PaymentMethod`, `PaymentMethodExtended`.
- **Frontend**: `apps/app/src/routes/_app/orders/index.tsx`, `apps/app/src/routes/_app/orders/new.tsx`, `apps/app/src/routes/_app/pos/counter.tsx` (venta rápida, nav "Venta rápida").
- **Desktop**: ninguno directo (pero el checkout dispara print jobs — ver `mangiar-printing`).

## Decisiones y convenciones

- **`OrdersModule` importa `PrintingModule` y `DeliveryModule` no al revés** — dirección unidireccional, igual que todo cross-module en este proyecto (ver `mangiar-architecture`).
- **Checkout** (`OrdersService.checkout`): si `Module.CASH` no está activo, cierra el pedido directo sin pedir sesión ni tocar caja. Si está activo, exige `sessionId` de una sesión `OPEN` y crea `CashMovement(type: SALE)` + el update del pedido en una sola transacción. En ambas ramas dispara `printJobsService.enqueueReceipt()` al final (no-opea solo si `Module.PRINTING` no está activo — ver `mangiar-printing`).
- **Fee de delivery resuelto server-side**: si `type === DELIVERY` y viene `deliveryZoneId`, el fee se busca en `DeliveryZone.fee` (nunca se confía en un fee mandado por el cliente); si no hay zona, cae al fallback `DeliveryConfig.deliveryFee`. Ver `mangiar-delivery`.
- **Envío a cocina** (`sendItemsToKitchen` + `PATCH /orders/:id/send-to-kitchen`): marca `OrderItem.sentToKitchen = true` en los items elegidos y dispara `printJobsService.enqueueKitchenTickets()`, que agrupa por categoría→estación→impresora — un mismo pedido puede generar varios `PrintJob` simultáneos, uno por estación (ver `mangiar-printing` para el detalle del agrupamiento).
- **Reglas de tipo de pedido**: `COUNTER` nunca lleva `tableId` (rechazado 400); `DELIVERY` exige `deliveryAddress`; `DINE_IN` sin `tableId` se rechaza solo si `Module.SALON` está activo (si no está activo, no hay mesas que elegir, así que se permite).
- `toPriceType()` mapea `OrderType` → `PriceType` para elegir qué precio de `Product.prices` usar: `COUNTER`/`TAKE_AWAY` → `TAKE_AWAY`, `DELIVERY` → `DELIVERY`, el resto → `DINE_IN`.

## Limitaciones conocidas

- La pantalla de venta rápida (`/pos/counter`) no tiene todavía una UI de descuentos ni de cliente/CUIT para facturación — si se pide, es trabajo nuevo. El flujo actual asume consumidor final salvo que se facture manualmente desde `/orders` (ver `mangiar-fiscal`).
