# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

pnpm workspace + Turborepo. `pnpm-workspace.yaml`: `apps/*` and `packages/*`.

- `apps/api` — NestJS 12 backend. Prisma 7 (`@prisma/adapter-pg`, not the classic `prisma-client-js` generator) against Postgres, Redis (`ioredis`) + Bull for queues, Socket.IO gateway for real-time push, JWT auth (access + refresh, refresh revocation list in Redis).
- `apps/app` — React 19 + TanStack Router/Query/Table renderer, Tailwind v4. This is the **single UI codebase** for both the browser app and the Electron app — there is no separate desktop UI.
- `apps/desktop` — Electron shell only. Main process loads `apps/app`'s built `dist/index.html` (prod) or `http://localhost:5173` (dev, the `apps/app` Vite dev server). Owns native-only concerns: `electron-store` for local config/device id, a thermal/USB printing bridge (`node-thermal-printer` + hidden-window `webContents.print`), and an IPC bridge in `preload/`. It also has a local SQLite (`better-sqlite3` + Drizzle) schema scaffolded for offline sync (`products`, `categories`, `orders`, `order_items`, `sync_queue`, `sync_meta`) that is currently **dead code** — nothing in `apps/app` queries it yet.
- `apps/admin` — Astro, shelved indefinitely (empty).
- `apps/e2e` — Playwright, with separate `chromium` and `electron` projects (`pnpm --filter desktop build` first for the electron project).
- `packages/shared` — Zod schemas + enums (`Module`, etc.) shared by `apps/api` and `apps/app`, built with `tsup`.
- `packages/tsconfig` — shared base tsconfig.

Deployment today is cloud-only: one Postgres + one API instance that both the browser app and every Electron install talk to directly (`VITE_API_URL`, baked in at `apps/app`'s Vite build). There is no local/offline/multi-terminal mode yet.

## Conventions

- **Package manager**: `pnpm` only. Never `npm`/`npx` — use `pnpm exec <tool>` for devDependency CLIs (Prisma, Vite, etc.).
- **TypeScript**: never type with `any`. Use the real type, a generic, or `unknown` + narrowing instead.
- **Skills**: after finishing an entire task, update the relevant `.claude/skills/mangiar-*/SKILL.md` (or this file, for cross-cutting conventions) with anything a future session would otherwise have to rediscover — a new pattern, a gotcha, a decision made along the way.

## Commands

All from the repo root unless noted.

```bash
pnpm dev                 # turbo run dev — api (nest --watch) + app (vite) + desktop (electron) together
pnpm build               # turbo run build
pnpm turbo run typecheck # typecheck all 5 packages — must be clean before considering anything done
pnpm turbo run lint
```

Per-app, when you only touched one package:

```bash
cd apps/api && pnpm test              # jest, rootDir=src, matches *.spec.ts
cd apps/api && pnpm test -- <pattern> # single test file/suite
cd apps/api && pnpm test:e2e          # jest against ./test/jest-e2e.json
cd apps/app && pnpm exec vite build   # regenerates routeTree.gen.ts (TanStack Router) and confirms the bundle compiles
cd apps/e2e && pnpm test:e2e          # playwright, chromium project
cd apps/e2e && pnpm test:e2e:electron # builds desktop first, then runs the electron project
```

Docker (Postgres 16 + Redis 7, see `docker-compose.yml`):

```bash
docker compose up -d
docker exec v2-postgres-1 psql -U postgres -d mangiar -c "..."   # inspect/seed data directly — don't trust typecheck alone
```

**Never** run `pnpm turbo run build` for the whole monorepo while `apps/api`'s `nest start --watch` is already running elsewhere — it clobbers the `dist` the watcher expects and two processes fight over port 3000. On Windows, if the API seems stuck on stale logs, check for a duplicate `node.exe` with `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, ParentProcessId, CreationDate, CommandLine` before killing anything — a `pnpm run dev` the user has running in their own terminal can share a console process group, so killing the wrong PID can cascade and take down their whole stack (including an open Electron window).

## Prisma migrations

`prisma migrate dev` does not work in a non-interactive agent session. Never hand-write migration SQL either. From `apps/api`:

```bash
pnpm exec prisma format
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_<name>"
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "prisma/migrations/${TS}_<name>/migration.sql"
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

(`--from-config-datasource` rather than `--from-url` because Prisma 7's `generator client { provider = "prisma-client" }` uses `@prisma/adapter-pg`.)

Before adding a value to a shared enum (e.g. `Module`), grep for exhaustive `switch`/`Record<EnumName, ...>` over it — a new value with no default branch can fail silently.

## Architecture conventions

- **Module gating**: sellable features are values of the `Module` enum (kept in lockstep manually between `packages/shared/src/enums.ts` and `apps/api/prisma/schema.prisma`). A restaurant "buys" a module via `Subscription` rows (`restaurantId`, `module`, `status`). Backend: feature controllers get `@UseGuards(JwtAuthGuard, ModuleGuard)` + `@RequiresModule(Module.X)`; `ModuleGuard` resolves `user.activeModules` fresh on every request (never cached in the JWT), so disabling a module takes effect immediately. Frontend: `useModules()` / `hasModule(Module.X)` + `<ModuleGuard module={Module.X}>`, nav items filtered the same way. CORE flows that are optionally enhanced by an add-on module (orders+CASH, orders+PRINTING, orders+DELIVERY) check `activeModules` inline and no-op/fallback gracefully — never a hard 403 on a CORE flow. No module-purchase UI exists yet; activate one in dev by inserting/updating a `Subscription` row directly in Postgres.
- **Audit log**: generic `AuditLog` model (`restaurantId`, `actorId`, `action`, `entityType`, `entityId`, `metadata`) + `AuditLogService` (`apps/api/src/common/audit/`, `@Global()` like `PrismaModule`, inject directly without importing `AuditModule`). Today only covers `CASH_SESSION_REOPENED` and expense update/delete — the long-term goal is auditing as much as possible, so add new `AuditAction` values (schema + shared enum) as sensitive actions are touched.
- **Real-time**: `EventsGateway` (`apps/api/src/modules/websockets/events.gateway.ts`). Every gateway handler needs `@SkipThrottle()` — the global `ThrottlerGuard` (via `APP_GUARD`) crashes in a WS context (no Express `res`). Clients join a `restaurant:<id>` room; a new push event is added as an `emitX` method on the gateway and consumed by connecting the socket singleton (`apps/app/src/lib/socket.ts`) with `.on("evento", handler)`. The print-job listener lives in `AppShell.tsx` (not the owning page) so it fires regardless of which screen is open — follow that pattern for anything that must work app-wide.
- **Tenant scoping**: almost every Prisma model carries `restaurantId` (+ FK + index); `Restaurant` is the sole tenant boundary. There is no `Device`/`Session` model — JWT payload is just `{ sub, type }`.
- **`apps/desktop` is the priority platform**: a UI change must look and work identically in the browser (`apps/app` served directly) and inside Electron. An agent session can't open a real Electron window — ask the user to confirm visual changes via `pnpm run dev` in `apps/desktop`.
- All prices render through `formatPrice()` (Argentine format, `$` baked in); number inputs must not react to scroll.
- **Toda eliminación debe confirmarse antes de ejecutarse** — ningún botón "Eliminar"/`variant="destructive"` dispara la mutación directo al click; siempre media un paso de confirmación explícito del usuario primero (pedido explícito del usuario, 2026). El patrón ya establecido en la app es una confirmación **inline** dentro del mismo panel (estado local tipo `pendingDelete`/`confirmingDelete` que reemplaza los botones normales por una fila "¿Seguro? — No / Sí, eliminar", mismo estilo ghost+destructive) — no un `window.confirm()` ni un modal nuevo (ver `mangiar-ui-ux`, no hay componente de Dialog en el repo). Ejemplos ya migrados a este patrón: `OrderDetailPanel.tsx` (quitar ítem/cancelar pedido) y `menu/products/index.tsx` (eliminar producto). Pantallas más viejas que todavía borran sin preguntar (ingredientes, proveedores) quedan pendientes de migrar — si se toca esa pantalla por otro motivo, de paso agregarle la confirmación.
- **Ese mismo bloque de confirmación tiene que mostrar el error si el delete falla** — no alcanza con el paso de "¿Seguro?"; si la mutación de borrado tira (típicamente una FK violation porque la entidad tiene registros asociados), hay que renderizar `mutation.isError` ahí mismo (helper local `extractErrorMessage(error, fallback)` sobre un `AxiosError`, duplicado a propósito en varios archivos — ver `menu/products/index.tsx` o `orders/new.tsx`) y llamar `mutation.reset()` al cerrar/cancelar/reabrir para no dejar un error viejo pegado. Pasó una vez con productos: el borrado fallaba contra una FK (`OrderItem` referenciándolo) y la UI no mostraba nada — al usuario le parecía que el botón no hacía nada. En el backend, el patrón para esa FK violation es atrapar `PrismaClientKnownRequestError` código `P2003` y convertirlo en un `ConflictException` (409) con mensaje en español explicando qué lo referencia — nunca dejar que el filtro global lo devuelva como 500 genérico (ver `tables.service.ts` y `products.service.ts` para el mismo patrón ya aplicado).

## Backend modules (`apps/api/src/modules`)

`auth`, `business-hours`, `cash`, `categories`, `delivery`, `expenses`, `fiscal` (AFIP/ARCA invoicing via the `facturas` npm package), `health`, `inventory`, `orders`, `printing` (stations/printers/print-jobs), `products`, `reservations`, `restaurants`, `salon` (floor plan/tables), `subscriptions`, `suppliers`, `users`, `websockets`.

Per-domain conventions and gotchas (availability algorithms, cash arqueo math, delivery radius calc, printing/Electron bridge details, etc.) live in `.claude/skills/mangiar-*` — load the matching skill before working deeply in one of these modules rather than re-deriving it from the code.
