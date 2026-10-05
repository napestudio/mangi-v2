---
name: mangiar-settings
description: Configuración general de Mangiar v2 — datos del restaurante, horario de atención, y el shell de navegación de Configuración. Usar al trabajar en el perfil del restaurante, horarios de apertura, o agregar una página nueva a /settings.
---

# Mangiar v2 — Configuración general

Datos de perfil del restaurante y horario de atención, más el shell de navegación que todas las páginas de `/settings/*` comparten (incluidas las de otros módulos: Salón, Reservas, Delivery, Fiscal, Impresión). Ambos sub-módulos son CORE. Ver `mangiar-ui-ux` para la convención de sidebar (excepción documentada a la nav top-bar general).

## Mapa de archivos

- **Backend**: `apps/api/src/modules/restaurants/` (`restaurants.controller.ts`/`restaurants.service.ts`, `restaurants.module.ts`, `dto/update-restaurant.dto.ts`) + `apps/api/src/modules/business-hours/` (`business-hours.controller.ts`/`business-hours.service.ts`, `business-hours.module.ts`, `dto/upsert-business-hours.dto.ts`).
- **Prisma**: `Restaurant` (incluye `latitude`/`longitude`, agregados para Delivery pero viven acá), `BusinessHours`.
- **Shared**: `packages/shared/src/schemas/restaurants.schema.ts` (enum `RestaurantType`), `packages/shared/src/schemas/business-hours.schema.ts` (sin enum propio).
- **Frontend**: `apps/app/src/routes/_app/settings/restaurant.tsx` (perfil + horarios, ambos en la misma pantalla), `apps/app/src/routes/_app/settings/route.tsx` (el shell de sidebar — `SETTINGS_NAV_ITEMS`, acá se agrega el link de cualquier página de settings nueva, de cualquier módulo).
- **Desktop**: ninguno.

## Decisiones y convenciones

- `settings/restaurant.tsx` mezcla dos conceptos (perfil del restaurante + horario de atención) en una sola pantalla — no están separados en dos rutas. Si crece mucho, separarlos es una opción, pero no asumir que ya están separados.
- `settings/route.tsx` es el único lugar donde la nav rompe la regla general de "top bar, solo iconos" (ver `mangiar-ui-ux`) — es sidebar con texto, a pedido explícito del usuario. Cada módulo nuevo con página de configuración se agrega ahí con `{ label, to, module? }`, filtrado por `hasModule()` si corresponde.
- `BusinessHoursStatus` (si el restaurante está "Abierto"/"Cerrado" ahora mismo) se consulta desde `AppShell` con `refetchInterval: 60_000` y se muestra como badge junto al nombre del restaurante — no es exclusivo de esta pantalla de settings, es estado global visible siempre.
- `BusinessHours` también enforcea reglas de negocio en Orders (ej. restricciones de `OrderType` según el turno activo) — no es solo informativo para la UI.

## Limitaciones conocidas

- Ninguna documentada explícitamente.
