---
name: mangiar-settings
description: Configuración general de Mangiar v2 — datos del restaurante, horario de atención, y el shell de navegación de Configuración. Usar al trabajar en el perfil del restaurante, horarios de apertura, o agregar una página nueva a /settings.
---

# Mangiar v2 — Configuración general

Datos de perfil del restaurante y horario de atención, más el shell de navegación que todas las páginas de `/settings/*` comparten (incluidas las de otros módulos: Salón, Reservas, Delivery, Fiscal, Impresión). Ambos sub-módulos son CORE. Ver `mangiar-ui-ux` para la convención de sidebar (excepción documentada a la nav top-bar general).

## Mapa de archivos

- **Backend**: `apps/api/src/modules/restaurants/` (`restaurants.controller.ts`/`restaurants.service.ts`, `restaurants.module.ts`, `dto/update-restaurant.dto.ts`) + `apps/api/src/modules/business-hours/` (`business-hours.controller.ts`/`business-hours.service.ts`, `business-hours.module.ts`, `dto/upsert-business-hours.dto.ts`).
- **Prisma**: `Restaurant` (incluye `latitude`/`longitude`, agregados para Delivery pero viven acá), `BusinessHours` (una fila = un turno/shift, no un día).
- **Shared**: `packages/shared/src/schemas/restaurants.schema.ts` (enum `RestaurantType`), `packages/shared/src/schemas/business-hours.schema.ts` (sin enum propio), `packages/shared/src/utils/time-grid.ts` (`timeRangeToIntervals` — parte una franja que cruza medianoche en uno o dos intervalos `[start, end)`, usado para detectar solapamientos).
- **Frontend**: `apps/app/src/routes/_app/settings/restaurant.tsx` (perfil + horarios, ambos en la misma pantalla), `apps/app/src/routes/_app/settings/route.tsx` (el shell de sidebar — `SETTINGS_NAV_ITEMS`, acá se agrega el link de cualquier página de settings nueva, de cualquier módulo).
- **Desktop**: ninguno.

## Decisiones y convenciones

- `settings/restaurant.tsx` mezcla dos conceptos (perfil del restaurante + horario de atención) en una sola pantalla — no están separados en dos rutas. Si crece mucho, separarlos es una opción, pero no asumir que ya están separados.
- `settings/route.tsx` es el único lugar donde la nav rompe la regla general de "top bar, solo iconos" (ver `mangiar-ui-ux`) — es sidebar con texto, a pedido explícito del usuario. Cada módulo nuevo con página de configuración se agrega ahí con `{ label, to, module? }`, filtrado por `hasModule()` si corresponde.
- **`BusinessHours` es shift-based, no day-based**: cada fila es un turno (`dayOfWeek`, `openTime`, `closeTime`, `label?`), y un mismo `dayOfWeek` puede tener varias filas — así se soportan horarios cortados (ej. lunes 06:00–12:00 y 16:00–23:00). No existe columna `isOpen`: un día está "cerrado" cuando no tiene ninguna fila. `BusinessHoursService.upsert()` reemplaza el set completo por restaurante en una transacción (`deleteMany` + `createMany`), no hace upsert fila por fila — el DTO no tiene `id` por turno, el frontend manda la lista completa cada vez.
- **Validación de solapamiento**: `BusinessHoursService` rechaza (400) dos turnos del mismo día que se superponen (usa `timeRangeToIntervals` de `time-grid.ts` para partir turnos que cruzan medianoche antes de comparar) y rechaza un turno con `openTime === closeTime`. Turnos que se tocan en el borde (ej. 06:00–12:00 y 12:00–18:00) son válidos, no se consideran solapados.
- **`getStatus()` resuelve turnos que cruzan medianoche correctamente**: si son las 01:00 y hoy es sábado, un turno de **viernes** 22:00–02:00 todavía puede estar activo — `getStatus` chequea tanto los turnos de hoy como los turnos de ayer que crucen medianoche, no solo los de `dayOfWeek === hoy`. Si se toca este método, no asumir que alcanza con filtrar por el día actual.
- `BusinessHoursStatus` (si el restaurante está "Abierto"/"Cerrado" ahora mismo, más `activeShift`/`todayShifts`/`nextChange`) se consulta desde `AppShell` con `refetchInterval: 60_000` y se muestra como badge junto al nombre del restaurante — no es exclusivo de esta pantalla de settings, es estado global visible siempre. Hoy en día solo se consume el campo `isOpen` (en `AppShell` y en `orders/new.tsx`); `activeShift`/`todayShifts`/`nextChange` están calculados pero sin UI todavía.
- `BusinessHours` **no** bloquea duro ningún flujo de Orders todavía: `orders/new.tsx` solo muestra un aviso ("El local figura cerrado...") cuando `isOpen` es `false`, pero deja cargar el pedido igual. No hay restricción de `OrderType` por turno activo en `orders.service.ts` — si se agrega en el futuro, debe seguir el patrón de degradación graceful de `mangiar-architecture` (nunca un 403 duro en un flujo CORE).

## Limitaciones conocidas

- Ninguna abierta.
