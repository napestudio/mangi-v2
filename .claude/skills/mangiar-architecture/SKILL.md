---
name: mangiar-architecture
description: Convenciones transversales de ingeniería de Mangiar v2 (monorepo NestJS + React + Electron + Prisma). Usar antes de migrar el schema, agregar un módulo nuevo, gatear una feature por suscripción, o validar un cambio contra el backend real.
---

# Mangiar v2 — convenciones transversales

Referenciada por las 13 skills de módulo (`mangiar-salon`, `mangiar-cash`, etc.) para no repetir estas reglas en cada una. Monorepo: `apps/api` (NestJS + Prisma 7 + Postgres), `apps/app` (React + TanStack Router, renderer compartido por browser y Electron), `apps/desktop` (Electron shell), `packages/shared` (Zod schemas + enums TS usados por ambos).

## Prisma: cómo migrar

`prisma migrate dev` **no funciona** en sesiones de agente (TTY no interactivo). Nunca usar `migrate dev` ni escribir el SQL de la migración a mano. El flujo que sí funciona, siempre desde `apps/api`:

```bash
pnpm exec prisma format
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_<nombre>"
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "prisma/migrations/${TS}_<nombre>/migration.sql"
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

(Prisma 7 usa `generator client { provider = "prisma-client" }` con `@prisma/adapter-pg`, no el clásico `prisma-client-js`; por eso `--from-config-datasource` en vez de `--from-url`.)

Antes de agregar un valor a un enum compartido (ej. `Module`), grepear el repo por `switch` exhaustivos o `Record<EnumName, ...>` sobre ese enum — un valor nuevo sin branch por default puede romper algo silenciosamente.

## Gestor de paquetes: solo pnpm

Nunca `npm`/`npx`. Siempre `pnpm add`/`pnpm exec <tool>` para CLIs de devDependencies (Prisma, Vite, tsc). Si una dependencia nueva requiere compilar un módulo nativo (node-gyp) y pnpm bloquea el postinstall con `ERR_PNPM_IGNORED_BUILDS`, no aprobar el build sin que el usuario lo pida explícitamente — preferir una alternativa sin dependencias nativas si existe (ver `mangiar-printing` para un caso real de esto).

## Patrón de module-gating (features vendibles por separado)

Cada feature opcional del producto es un valor del enum `Module` (`packages/shared/src/enums.ts` + `apps/api/prisma/schema.prisma`, mantenidos en lockstep manualmente). Un restaurante "compra" módulos vía filas en `Subscription` (`restaurantId`, `module`, `status: TRIAL|ACTIVE|...`).

- **Backend**: todo controller de una feature opcional lleva `@UseGuards(JwtAuthGuard, ModuleGuard)` + `@RequiresModule(Module.X)` (decorators en `apps/api/src/common/`). `ModuleGuard` lee `user.activeModules` — resuelto **en cada request** vía `SubscriptionsService.getActiveModules(restaurantId)` en el JWT strategy, nunca cacheado en el token, así que desactivar un módulo tiene efecto inmediato.
- **Frontend**: `useModules()` hook (`hasModule(Module.X)`) + componente `<ModuleGuard module={Module.X}>` envolviendo la página. Ítems de nav se filtran con `!item.module || hasModule(item.module)`.
- **Degradación graceful**: cuando una feature CORE (orders, por ejemplo) tiene un paso opcionalmente potenciado por otro módulo (CASH, DELIVERY, PRINTING), el service chequea `activeModules.includes(Module.X)` el mismo y hace un no-op o un fallback simple si no está activo — nunca un 403 duro en un flujo CORE. Ejemplos reales: `OrdersService.checkout()` solo exige `sessionId` si CASH está activo; `PrintJobsService` no-opea silenciosamente si PRINTING no está activo.
- Para activar un módulo manualmente en dev/testing (no hay UI de compra de módulos todavía): insertar una fila en `Subscription` por SQL directo, o reactivar una existente con `status='ACTIVE'`.

## Patrón de auditoría (`AuditLog`)

Modelo genérico (`restaurantId`, `actorId`, `action: AuditAction`, `entityType`, `entityId`, `metadata: Json`) + `AuditLogService` (`apps/api/src/common/audit/`, `@Global()` como `PrismaModule` — se inyecta directo, sin importar `AuditModule` en el módulo feature). Es la v1 de un objetivo más grande del usuario ("auditar todo lo posible" con el tiempo) — hoy solo cubre `CASH_SESSION_REOPENED` y `EXPENSE_UPDATED`/`EXPENSE_DELETED`. Al agregar una acción sensible nueva (cambios de precio, cancelación de reservas, ajustes de stock, permisos de usuarios, pagos a proveedores...): agregar el valor a `AuditAction` en schema.prisma + `packages/shared/src/enums.ts`, migrar, inyectar `AuditLogService`, loguear con snapshot de "antes" cuando aplique. Pendiente: UI para visualizarlo, y soporte para loguear dentro de una transacción Prisma (`tx`) cuando haga falta atomicidad.

## Metodología de validación (seguida en cada stage construido)

1. `pnpm turbo run typecheck` en la raíz — debe quedar limpio en los 5 paquetes antes de considerar algo terminado.
2. Si se tocó `apps/app`: `cd apps/app && pnpm exec vite build` — regenera `routeTree.gen.ts` (TanStack Router) y confirma que el bundle compila. **Nunca** `pnpm turbo run build` para todo el monorepo mientras `apps/api` tiene `nest start --watch` corriendo — pisa el `dist` que el watcher espera y deja dos supervisores peleando por el puerto 3000.
3. Validar en vivo contra el Postgres/Redis dockerizado real (`docker exec v2-postgres-1 psql -U postgres -d mangiar -c "..."` para inspeccionar/sembrar datos), nunca asumir que algo funciona por el typecheck solo. Reproducir el escenario exacto con `curl` autenticado (login → token → request), confirmar en la base, y limpiar los datos de prueba al final (o dejarlos si son configuración legítima reusada entre sesiones, como las cajas de prueba).
4. Para activar/desactivar un módulo durante el test: ver sección de module-gating arriba.
5. Recordar que `apps/desktop` (Electron) es la plataforma prioritaria — un cambio de UI debe funcionar igual en `apps/app` servido por browser y dentro de Electron. Esta sesión de agente no puede abrir una ventana Electron real; cuando el cambio es visual, pedirle al usuario que lo confirme en `pnpm run dev` dentro de `apps/desktop`.

## Trampa de procesos duplicados (Windows)

Si el dev server de la API no responde o muestra logs viejos, probablemente hay dos `nest start --watch` compitiendo por el puerto 3000. Diagnosticar con PowerShell:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, ParentProcessId, CreationDate, CommandLine
```

**Cuidado real:** si el usuario tiene `pnpm run dev` (turbo, lanza api+app+desktop+Electron juntos) corriendo en su propia terminal, esos procesos pueden compartir el mismo grupo de consola de Windows que un proceso que el agente mata — `Stop-Process` sobre un PID de ese árbol puede cascadear y matar **todo** el stack del usuario, incluyendo una ventana de Electron que tenía abierta. Antes de matar cualquier `node.exe`, revisar `ParentProcessId`/`CreationDate` para identificar cuál es realmente el proceso redundante (el que el agente mismo lanzó en este turno) y evitar tocar los que el usuario inició. Si pasa igual, avisar inmediatamente — no relanzar el stack del usuario por su cuenta sin que lo pida.

## WebSockets en tiempo real

`EventsGateway` (`apps/api/src/modules/websockets/events.gateway.ts`) — todos los gateways necesitan `@SkipThrottle()` porque el `ThrottlerGuard` global (vía `APP_GUARD`) crashea en contexto WS (no hay `res` de Express). Un evento nuevo (`emitX`) se suscribe en el cliente conectando el socket singleton (`apps/app/src/lib/socket.ts`) y agregando un `.on("evento", handler)` — el listener global de impresión vive en `AppShell.tsx` para que funcione sin importar qué pantalla esté abierta, no solo en la página dueña del feature.
