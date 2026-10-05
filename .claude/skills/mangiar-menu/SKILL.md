---
name: mangiar-menu
description: Menú de Mangiar v2 — productos, categorías y precios por tipo de pedido. Usar al trabajar en el catálogo de productos, categorías, modificadores, o precios diferenciados por DINE_IN/TAKE_AWAY/DELIVERY.
---

# Mangiar v2 — Menú

Catálogo de productos y categorías, con precios diferenciados por tipo de pedido. Es CORE (sin módulo propio, siempre disponible) — casi todo otro módulo lo lee (Orders, Inventory, Suppliers, Printing vía categorías/estaciones). Ver `mangiar-architecture`.

## Mapa de archivos

- **Backend**: `apps/api/src/modules/products/` (`products.controller.ts`/`products.service.ts`, `products.module.ts`, `dto/create-product.dto.ts`, `dto/update-product.dto.ts`) + `apps/api/src/modules/categories/` (`categories.controller.ts`/`categories.service.ts`, `categories.module.ts`, `dto/create-category.dto.ts`, `dto/update-category.dto.ts`).
- **Prisma**: `Product`, `ProductPrice` (se borra/recrea en transacción en cada update, no se hace upsert fila-por-fila), `Category`.
- **Shared**: `packages/shared/src/schemas/products.schema.ts`, `packages/shared/src/schemas/categories.schema.ts`; enums `PriceType`, `ProductTag`, `UnitType`, `WeightUnit`, `VolumeUnit`.
- **Frontend**: `apps/app/src/routes/_app/menu/products/index.tsx` (gestiona productos; categorías aparecen ahí como selector, sin pantalla propia de categorías todavía).
- **Desktop**: ninguno.

## Decisiones y convenciones

- `ProductPrice` tiene una fila por `PriceType` (`DINE_IN`, `TAKE_AWAY`, `DELIVERY`) — un producto sin precio configurado para el tipo que necesita un pedido (`toPriceType()` en `mangiar-orders`) hace que ese pedido falle con 400 "no tiene precio configurado para X", no que caiga a un precio default silencioso.
- `Category` es compartida entre Menú y Printing (`StationCategory` vincula una categoría a una estación de impresión) — borrar o reestructurar categorías libremente puede romper el agrupamiento de tickets de cocina sin que Menú lo sepa.
- Los `ModifierOption`/`ModifierGroup` (modificadores de producto) están modelados en Prisma y se usan en `orders.service.ts` al armar un `OrderItem`, pero no hay una pantalla de gestión de modificadores en este módulo todavía — si se pide, es trabajo de UI nuevo sobre un modelo que ya existe.

## Limitaciones conocidas

- No hay pantalla dedicada de categorías (solo aparecen embebidas en el selector de productos) — crearla sería trabajo nuevo si el usuario la pide.
- No hay gestión de modificadores en la UI (ver arriba).
