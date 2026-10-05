---
name: mangiar-ui-ux
description: Convenciones de UI/UX generales de Mangiar v2 (apps/app, React + Tailwind v4). Usar al tocar navegación, crear una pantalla CRUD nueva, un formulario, o cualquier decisión visual/de layout que deba verse igual en el navegador y en Electron.
---

# Mangiar v2 — convenciones de UI/UX

Para convenciones de backend/arquitectura ver `mangiar-architecture`. Esta skill cubre decisiones de producto visual tomadas a lo largo de las 12 etapas, muchas de ellas pedidas explícitamente por el usuario — no son preferencia del agente, son requisitos confirmados.

## Prioridad de plataforma

`apps/desktop` (Electron) es la plataforma prioritaria del producto. `apps/app` es el mismo renderer servido tanto por el browser (dev: `localhost:5173`) como por Electron (prod: `app/dist/index.html`) — **todo cambio visual debe verse igual en ambos**, no diseñar algo "solo para browser". Esta sesión de agente no puede renderizar una ventana Electron real (no hay entorno gráfico); cuando el cambio es puramente visual, decirlo explícitamente y pedirle al usuario que confirme con `pnpm run dev` dentro de `apps/desktop`.

## Navegación

- **Regla**: la nav de `AppShell` es una barra superior, centrada, **solo iconos** (`lucide-react`), sin texto ni sidebar. `title`/`aria-label` llevan el label en español para accesibilidad, pero no se muestra como texto visible.
- **Forma**: el `<nav>` es una píldora blanca flotante — `rounded-full bg-white shadow-md` — sobre fondo general `bg-neutral-50` (puesto en el contenedor raíz de `AppShell`), no una barra blanca de borde a borde. Cada ítem es un botón circular (`rounded-full`, hit-box 40×40). El ítem activo (vía `activeProps` de TanStack Router) se ve como un círculo sólido `bg-red-500 text-white` — ver `apps/app/src/components/layout/AppShell.tsx`.
- **Excepción documentada**: la sección de Configuración (`/settings/*`) usa deliberadamente un sidebar a la izquierda con texto (`apps/app/src/routes/_app/settings/route.tsx`) — fue un pedido explícito del usuario, no una inconsistencia a corregir. Nuevas páginas de configuración se agregan a `SETTINGS_NAV_ITEMS` ahí, no al nav superior. El `<aside>` de ese sidebar lleva fondo de marca `rounded-2xl bg-red-500`, texto blanco para ítems inactivos, y el ítem activo es una píldora blanca con texto `red-500`.
- Un ítem de nav opcional por módulo lleva `module: Module.X` y se filtra con `useModules().hasModule()`.

## Patrón CRUD estándar (DataTable + SidePanel)

Casi toda pantalla de listado sigue el mismo esqueleto, visto en `suppliers/index.tsx`, `expenses/index.tsx`, `settings/delivery.tsx`, etc.:
- `<DataTable columns={...} data={...} isLoading={...} onRowClick={panel.open} />` para el listado.
- Crear: un formulario **inline** que aparece arriba de la tabla al tocar el botón "+" (estado `creating`/`setCreating`), no un modal.
- Ver/editar un registro existente: `<SidePanel>` (`useSidePanel<T>()`) que se abre con la fila clickeada, panel lateral derecho con `dl`/`dt`/`dd` para el detalle y botones de acción abajo.
- **Única excepción deliberada**: `/pos/counter` (venta rápida) — grid de productos tappable en vez de tabla, carrito a la derecha, optimizado para velocidad táctil, no para explorar datos. No replicar el patrón DataTable ahí.

## Componentes y estilos

- Componentes de UI propios en Tailwind v4 (`apps/app/src/components/ui/`) — **nunca** shadcn/ui, es una decisión de proyecto de larga data.
- **Color de marca**: `red-500` (paleta default de Tailwind, sin token custom) es el rojo principal — se usa en toda acción principal/positiva (`<Button>` sin `variant`, ej. "Guardar cambios", "Cerrar orden", "Confirmar pago", "Cobrar") y en el fondo del sidebar de Configuración. Ver `apps/app/src/components/ui/button.tsx`: el variant `default` es `bg-red-500 text-white hover:bg-red-600`.
- **Botones destructivos** (`variant="destructive"`, ej. "Eliminar X") usan `red-700` (un escalón más oscuro que el `red-500` primario, para no confundirse con una acción positiva) y **siempre** muestran un ícono de tacho (`Trash2` de lucide-react) — lo agrega automáticamente el componente `Button` cuando `variant === "destructive"`, no hace falta (ni se debe) pasarlo a mano en los `children`.
- Una acción de "cerrar/confirmar" (ej. "Cerrar caja") no es destructiva aunque termine una sesión — usa el variant `default` (rojo de marca), no `destructive`. El criterio es: ¿borra o elimina algo? → `destructive`. ¿Confirma, cierra o guarda? → `default`.
- Solo modo claro: `color-scheme: light` fijo en `index.css` (no `light dark`). El bug real que esto arregló: con `light dark` + un OS en modo oscuro, inputs con `bg-white` hardcodeado mostraban texto blanco sobre blanco invisible. La app no tiene soporte de dark mode, no agregarlo a medias.
- Labels de UI siempre en español (incluyendo unidades: "Kilogramo" no "Kilogram", etc.) — convención confirmada explícitamente por el usuario para toda la interfaz, no solo para inventario donde se pidió primero.

## Formularios y staff-attribution

Toda entidad que registra una acción de un empleado (movimiento de caja, gasto, apertura/cierre de sesión) tiene un campo opcional `xById` que default-ea a `currentUserId` pero se puede sobreescribir con el componente `<StaffPicker value={...} onChange={...} />` (`apps/app/src/components/staff/StaffPicker.tsx`), validado server-side contra el roster del restaurante.

## Guards de módulo en UI

`<ModuleGuard module={Module.X}>` envuelve el componente de una ruta entera cuando la feature completa depende de un módulo opcional (ej. `/expenses`, `/invoices`); dentro de una página CORE que solo tiene un paso opcionalmente potenciado (ej. `/orders` con el botón "Facturar"), se usa `hasModule()` inline para mostrar/ocultar ese fragmento puntual en vez de gatear la página entera.
