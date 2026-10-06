---
name: mangiar-reservations
description: Reservas de Mangiar v2 — turnos (time slots), disponibilidad, overbooking y asignación de mesas. Usar al trabajar en el algoritmo de disponibilidad, conflictos de mesa, horarios que cruzan medianoche, o el calendario de reservas.
---

# Mangiar v2 — Reservas

El módulo más hardeneado del proyecto — pasó por varias rondas de bug reports reales del usuario sobre timezone y overbooking. Leer esta skill completa antes de tocar `reservations.service.ts`; es fácil reintroducir un bug ya arreglado. Módulo `Module.RESERVATIONS`. Ver `mangiar-architecture` para convenciones transversales.

## Mapa de archivos

- **Backend** (`apps/api/src/modules/reservations/`): `reservations.controller.ts`/`reservations.service.ts`, `time-slots.controller.ts`/`time-slots.service.ts`, `reservations.module.ts`, `dto/create-reservation.dto.ts`, `dto/update-reservation.dto.ts`, `dto/update-reservation-status.dto.ts`, `dto/list-reservations.dto.ts`, `dto/check-availability.dto.ts`, `dto/create-time-slot.dto.ts`, `dto/update-time-slot.dto.ts`, `dto/assign-time-slot-tables.dto.ts`.
- **Prisma**: `Reservation`, `TimeSlot`, `TimeSlotTable`, `ReservationTable`, `Table` (de Salón), `Restaurant` (timezone).
- **Shared**: `packages/shared/src/schemas/reservations.schema.ts`; enum `ReservationStatus`. Funciones puras isomórficas de grilla horaria en `packages/shared/src/utils/time-grid.ts` (usables por frontend y backend).
- **Node-only**: `apps/api/src/common/time-window.util.ts` — re-exporta las funciones puras de `time-grid.ts` más utilidades que necesitan `Intl`/Node (`zonedNow`, `getTimezoneOffsetMinutes`, `zonedTimeToUtcISO`, `addDays`).
- **Frontend**: `apps/app/src/routes/_app/reservations/index.tsx` (toggle "Por día" / "Próximas" — ver más abajo), `apps/app/src/routes/_app/reservations/new.tsx`, `apps/app/src/routes/_app/settings/reservations.tsx` (configuración de turnos/capacidad).
- **Desktop**: ninguno.

## Decisiones y convenciones (críticas — leer antes de modificar)

- **`businessDate` vs `date`**: `Reservation.businessDate` (`@db.Date`, el "día de turno" nominal) es distinto de `Reservation.date` (instante UTC real). Existen porque un turno que cruza medianoche (ej. 22:00–02:00) necesita agruparse bajo el día en que *empezó* para el day-picker y las estadísticas, aunque el instante real caiga en el día calendario siguiente. No usar `date` para agrupar por día en ninguna query nueva — usar `businessDate`.
- **Contrato de API de horario**: el cliente nunca construye el instante UTC él mismo (el bug original: `${date}T${time}:00.000Z`, que trataba la hora local como si fuera UTC literal). El cliente manda `businessDate` + `time` (hora local de pared); el backend resuelve el instante UTC real con `zonedTimeToUtcISO` usando el timezone del restaurante.
- **Algoritmo de disponibilidad, dos niveles** (`evaluateAvailability` en `reservations.service.ts`):
  1. **Capacidad/pacing**: siempre por `TimeSlot` individual, con matemática de ventana deslizante por solapamiento (no buckets fijos). `searchPadding = Math.max(SEARCH_PADDING_MS, windowMs)`.
  2. **Exclusividad de mesa**: una vez que una mesa se vincula vía `ReservationTable`, el chequeo es **restaurante-wide, a través de TODOS los turnos**, no solo del turno de la reserva nueva — un restaurante de sushi puede tener "Omakase" y "a la carta" como turnos distintos pero no puede dejar que ambos reserven la misma mesa física al mismo tiempo. Usa `TABLE_CONFLICT_SEARCH_PADDING_MS = 7 * 24 * 60 * 60 * 1000` y la duración propia del `TimeSlot` de cada reserva candidata.
- **Locks de concurrencia**: `tx.$executeRaw` (no `$queryRaw` — falla con "Failed to deserialize column of type 'void'") sobre `pg_advisory_xact_lock(hashtext(timeSlotId:businessDate))` dentro de `create()`/`update()`. `updateStatus()` también re-valida con lock+recheck cuando se reactiva una reserva desde `CANCELED`/`NO_SHOW` a un estado activo — ese branch específico fue un hueco de overbooking real que se encontró en auditoría.
- El usuario puede elegir solo horarios alineados a la grilla del turno (ej. turno 12:00–15:00 en bloques de 15min → 12:00, 12:15, 12:30...), nunca un horario arbitrario fuera del rango — validado con `isTimeGridAligned`/`isTimeWithinRange` de `time-grid.ts`.
- **`/reservations` tiene dos vistas**: "Por día" (default, `{from: date, to: date}`, el date picker de siempre) y "Próximas" (`{from: hoy}` sin `to`) para ver todo lo que viene sin tener que ir pasando día por día — `ListReservationsDto.to` ya era opcional de entrada (`findAll` solo aplica `lte` si viene), así que esta vista no pidió ningún cambio de backend. "Próximas" no filtra por `status`, así que también aparecen reservas `CANCELED`/`NO_SHOW` de hoy en adelante (es intencional: el usuario pidió poder *ver e interactuar* con las reservas futuras, no solo las activas).
- **`ReservationTable` bloquea borrar una `Table` en Salón** (ver `mangiar-salon`): `TablesService.remove()` solo lo permite si no quedan reservas en `PENDING`/`CONFIRMED`/`SEATED` para esa mesa; si no, borra los vínculos de las que ya terminaron (`CANCELED`/`NO_SHOW`/`COMPLETED`) antes de intentar el `delete`. Ese set de "bloqueantes" es **distinto** de `INACTIVE_STATUSES` de acá arriba (que es `[CANCELED, NO_SHOW]` y excluye `COMPLETED` porque `evaluateAvailability` solo mira conflictos hacia adelante en el tiempo) — para decidir si una reserva puede seguir "reteniendo" una mesa física que se quiere borrar, `COMPLETED` tampoco debería bloquear (ya pasó, no hay nada que proteger). Si se toca cualquiera de los dos sets, pensar cuál pregunta está respondiendo cada uno antes de unificarlos.

## Limitaciones conocidas

- Ninguna abierta — cada bug reportado (timezone, reactivación sin recheck, padding insuficiente, exclusividad de mesa cross-turno) fue arreglado y validado en vivo con reproducción exacta. Si aparece un reporte nuevo de "se sobrereservó", empezar releyendo `evaluateAvailability` completo antes de parchear algo puntual — este módulo ya tuvo varios bugs sutiles del mismo estilo.
