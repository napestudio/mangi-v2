---
name: mangiar-delivery
description: Delivery de Mangiar v2 — zonas de entrega por radio y configuración general de envíos. Usar al trabajar en zonas de delivery, cálculo de costo de envío, o la configuración del punto de referencia del restaurante.
---

# Mangiar v2 — Delivery

Zonas de entrega manuales por anillo de radio desde un punto de referencia (lat/lng del restaurante), con costo fijo por zona. Modelado para que geocoding real se pueda sumar después sin breaking change. Módulo `Module.DELIVERY`. Ver `mangiar-architecture`.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/delivery/`): `delivery-config.controller.ts`/`delivery-config.service.ts`, `delivery-zones.controller.ts`/`delivery-zones.service.ts`, `delivery.module.ts`, `dto/update-delivery-config.dto.ts`, `dto/create-delivery-zone.dto.ts`, `dto/update-delivery-zone.dto.ts`.
- **Prisma**: `DeliveryConfig`, `DeliveryZone`. `Restaurant.latitude`/`longitude` viven en el módulo `restaurants` (ver `mangiar-settings`), no acá.
- **Shared**: `packages/shared/src/schemas/delivery.schema.ts`; enum `DeliveryZoneType` (`RADIUS`, `POLYGON`).
- **Frontend**: `apps/app/src/routes/_app/settings/delivery.tsx`.
- **Desktop**: ninguno.

## Decisiones y convenciones

- `DeliveryZone.minRadiusMeters`/`maxRadiusMeters` definen un anillo desde el punto `Restaurant.latitude`/`longitude` — el frontend los muestra en km y convierte a metros al guardar. `priority` resuelve solapamiento de anillos (se evalúa el de prioridad más baja primero).
- **El fee nunca lo manda el cliente**: `OrdersService.create()` resuelve el costo de envío server-side consultando `DeliveryZone.fee` por `deliveryZoneId`, o cae a `DeliveryConfig.deliveryFee` como fallback si no hay zona — ver `mangiar-orders`.
- Desactivar una zona (`isActive: false`) la saca del picker para pedidos nuevos pero no afecta pedidos existentes que ya la tenían asignada (su `deliveryFee`/`total` quedan congelados).
- `@RequiresModule(Module.DELIVERY)` está solo en `delivery-config`/`delivery-zones` — el endpoint de crear pedidos (`orders`) sigue siendo CORE y nunca lo gatea, solo consulta el módulo internamente para decidir si usar zona o fallback (degradación graceful, ver `mangiar-architecture`).

## Limitaciones conocidas

- **`POLYGON` sin UI**: el enum `DeliveryZoneType` y el campo `DeliveryZone.polygon` (Json) están modelados pero deliberadamente sin editor visual — requiere una librería de mapas (ej. Leaflet) que no se justificó agregar todavía. Si se pide "zonas dibujadas a mano", ese es el punto de partida, no empezar de cero.
- No hay geocoding real: `latitude`/`longitude` del restaurante se ingresan a mano copiando coordenadas de Google Maps, y `Order.deliveryLatitude`/`deliveryLongitude` están modelados pero sin poblarse todavía (reservados para una integración futura).
