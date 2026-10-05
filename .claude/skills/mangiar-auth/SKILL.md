---
name: mangiar-auth
description: Autenticación y usuarios de Mangiar v2 — login, registro, roles, y el roster de staff. Usar al trabajar en login/logout, tokens JWT, roles de usuario, o el selector de staff (StaffPicker) que usan otros módulos.
---

# Mangiar v2 — Autenticación y usuarios

Login/registro, JWT access+refresh, roles, y el roster de empleados que otros módulos reutilizan para staff-attribution. Módulo CORE. Ver `mangiar-architecture` para cómo `activeModules` se resuelve en cada request desde este mismo flujo (JWT strategy).

## Mapa de archivos

- **Backend**: `apps/api/src/modules/auth/` (`auth.controller.ts`/`auth.service.ts`, `auth.module.ts`, `dto/login.dto.ts`, `dto/register.dto.ts`, `dto/refresh.dto.ts`, `guards/jwt-refresh.guard.ts`, `strategies/jwt-access.strategy.ts`, `strategies/jwt-refresh.strategy.ts`, `types.ts`) + `apps/api/src/modules/users/` (`users.controller.ts`/`users.service.ts`, `users.module.ts`, `dto/create-user.dto.ts`, `dto/update-user.dto.ts`).
- **Prisma**: `User`, `Restaurant`, `Subscription` (se crea una fila trial en el registro), `PasswordResetToken`, `UserPermissionGrant`.
- **Shared**: `packages/shared/src/schemas/auth.schema.ts`, `packages/shared/src/schemas/users.schema.ts`; enums `UserRole`, `RestaurantType`, `Module`. `PermissionGrant` está definido en Prisma/enums pero **sin usar** todavía en ningún lado del código — modelado, no conectado.
- **Frontend**: grupo de rutas separado `apps/app/src/routes/_auth/` (no `_app/`): `login.tsx`, `register.tsx`, `forgot-password.tsx`, `route.tsx`. No hay pantalla de gestión de staff dedicada — `<StaffPicker>` (ver `mangiar-ui-ux`) es el único punto de contacto con el roster, embebido dentro de Orders/Expenses/Cash.
- **Desktop**: ninguno directo, pero el `accessToken` del store de auth es lo que `AppShell` le pasa a Electron al invocar `print:job` (ver `mangiar-printing`).

## Decisiones y convenciones

- `activeModules` del login **no queda cacheado en el JWT** — `JwtAccessStrategy` resuelve `SubscriptionsService.getActiveModules(restaurantId)` fresco en cada request, así que activar/desactivar un módulo tiene efecto inmediato sin necesidad de re-loguearse (confirmado en vivo varias veces durante el desarrollo).
- El registro (`AuthService.register` o similar) crea `Restaurant` + `User` (ADMIN) + una `Subscription` trial en una transacción — cualquier módulo que necesite "sembrar" algo al alta de un restaurante nuevo debería sumarse a ese flujo, no asumir que corre después.
- `UserPermissionGrant`/`PermissionGrant` están completamente modelados pero sin ningún consumidor en el código — hoy el control de acceso real es solo por `UserRole` (`@Roles()` + `RolesGuard`), no por permisos granulares. No asumir que `PermissionGrant` hace algo.

## Limitaciones conocidas

- Sin pantalla de gestión de staff (alta/baja/edición de empleados, asignación de rol) — hoy un usuario nuevo solo se crea vía `POST /users` directo, sin UI dedicada. Si se pide, es trabajo nuevo.
- `PermissionGrant` sin conectar (ver arriba) — si se pide control de acceso más fino que por rol, ese modelo ya existe pero no tiene ningún guard que lo lea todavía.
