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
- **Header de `AppShell`** (`grid-cols-[1fr_auto_1fr]`): el slot izquierdo muestra solo el `<Logo />` (no el nombre del restaurante, no el badge de horario). El slot derecho agrupa, en orden: `{restaurant?.name}` → badge de horario (Abierto/Cerrado) → `<UserMenu />`. El logo es la marca de la app (slot izquierdo); el nombre del restaurante, su estado de horario y el usuario/sesión son datos del tenant actual (slot derecho) — no mezclar ambos grupos.
- **`<UserMenu />`** (`apps/app/src/components/layout/UserMenu.tsx`): reemplaza el viejo botón de logout suelto. Es un dropdown custom (sin librería — el repo no tiene Radix/Headless UI) que se abre al tocar el `<Avatar />` del usuario: `useState` para `open`, un `useRef` en el contenedor para cerrar con click afuera (`mousedown` + `!containerRef.current?.contains(event.target)`) y `Escape` para cerrar, mismo patrón que `SidePanel`. El panel (`absolute right-0 top-full mt-2 ... rounded-md border border-neutral-200 bg-white shadow-lg`, mismo look que el dropdown de `ProductSearchCombobox`) muestra el nombre arriba y debajo la lista de acciones — por ahora solo "Cerrar sesión" en `text-red-700` con el ícono `LogOut`. Nuevas acciones del usuario (perfil, cambiar restaurante, etc.) se agregan como más `button[role="menuitem"]` ahí, no como botones sueltos en el header.
- **`<Avatar />`** (`apps/app/src/components/ui/avatar.tsx`): círculo `bg-red-500 text-white` de 40×40 con las iniciales del nombre (toma `name ?? username`, primera+última palabra). Es el componente a extender el día que haya foto de perfil real — no crear un segundo avatar ad-hoc.

## Logo de marca

- La URL del logo es una constante única en `packages/shared/src/constants.ts` (`BRAND_LOGO_URL`, exportada desde `@mangiar/shared`) — **nunca** hardcodear la URL del logo en un componente. Si el logo cambia, se actualiza en un solo lugar y todos los frontends del monorepo lo heredan. Tras editar `constants.ts` hay que correr `pnpm --filter @mangiar/shared build` para que el `dist` (lo que realmente resuelven `apps/app`/`apps/desktop` via workspace) quede actualizado — editar solo el `src` no alcanza.
- El componente `<Logo />` (`apps/app/src/components/ui/logo.tsx`) es un simple `<img>` que consume `BRAND_LOGO_URL`, acepta `className`/el resto de los props de `img` (menos `src`/`alt`, fijos) vía `cn()`. Es el componente a reusar en cualquier pantalla de `apps/app` que necesite mostrar la marca (ej. login) en vez de repetir el `<img>` a mano.
- `apps/admin` (Astro, shelved) no puede importar un componente React de `apps/app`, pero sí puede importar `BRAND_LOGO_URL` de `@mangiar/shared` el día que se retome — por eso la URL vive en `packages/shared` y no en `apps/app`.

## Patrón CRUD estándar (DataTable + SidePanel)

Casi toda pantalla de listado sigue el mismo esqueleto, visto en `suppliers/index.tsx`, `expenses/index.tsx`, `settings/delivery.tsx`, etc.:

- `<DataTable columns={...} data={...} isLoading={...} onRowClick={panel.open} />` para el listado.
- Crear: un formulario **inline** que aparece arriba de la tabla al tocar el botón "+" (estado `creating`/`setCreating`), no un modal.
- Ver/editar un registro existente: `<SidePanel>` (`useSidePanel<T>()`) que se abre con la fila clickeada, panel lateral derecho con `dl`/`dt`/`dd` para el detalle y botones de acción abajo.
- **Única excepción deliberada al listado**: `/pos/counter` (venta rápida/mostrador) — grid de productos tappable en vez de tabla, carrito a la derecha, optimizado para velocidad táctil, no para explorar datos. No replicar el patrón DataTable ahí.
- **`SidePanel`'s `onClose` NO debe ir en el array de deps de ningún `useEffect` propio** (`apps/app/src/components/ui/side-panel.tsx`) — la mayoría de los callers pasan una función nueva en cada render (`panel.close` de `useSidePanel()` no está memoizada, tampoco lo están los `onClose` inline que define cada pantalla), así que un effect que dependa de `onClose` se re-dispara en cada re-render del padre — y como cada tecleo en un input dentro del panel ya causa ese re-render (`setForm`), el panel terminaba robándole el foco al input en cada letra (`panelRef.current?.focus()` corriendo de nuevo). Fix: `onClose` se guarda en un ref ("latest ref" pattern, `onCloseRef.current = onClose` durante el render) y el `useEffect` de focus/Escape depende solo de `[open]`. Si se agrega lógica nueva a ese `useEffect`, mantener ese patrón — no agregar `onClose` (ni cualquier prop-callback no memoizada) de vuelta al array de deps.
- **Excepción deliberada al alta inline — formularios largos con pasos**: cuando crear un registro tiene muchos campos agrupables en pasos lógicos (ej. `menu/products/index.tsx`), el alta puede vivir **dentro del mismo `SidePanel`** que ya se usa para editar (en vez del formulario inline arriba de la tabla) y renderizar un `<Wizard>` (`apps/app/src/components/ui/wizard.tsx`) en lugar del form plano. La edición de un registro existente sigue el patrón de siempre (form plano dentro del `SidePanel`, sin pasos) — el wizard es solo para el alta. Ver el bullet de `<Wizard>` más abajo y `mangiar-menu` para el caso de uso completo.

### `<Wizard>` — pasos genéricos y reutilizables

`apps/app/src/components/ui/wizard.tsx` — shell de navegación por pasos, deliberadamente minimalista para poder reusarse en cualquier formulario largo futuro, no solo productos:

- Maneja únicamente el índice del paso actual, el indicador visual (círculos numerados + línea, `bg-red-500` para completados/activo) y los botones "Atrás"/"Siguiente"/"Cancelar" — **no sabe nada de validación de negocio ni de qué hace el botón final**. Cada paso (`WizardStep`) trae su propio `content: ReactNode` y un `isValid?: boolean` opcional que gatea el botón "Siguiente" de ESE paso (si no se pasa, el paso se asume válido siempre — usar esto para pasos opcionales, ej. "Imagen" o "Etiquetas").
- **Layout fijo: solo `content` scrollea** (pedido explícito del usuario — "los botones de siguiente/atrás/guardar siempre tienen que estar al fondo, lo que debe scrollear es el contenido del paso"). `Wizard` es internamente `flex h-full min-h-0 flex-col` con 3 franjas: indicador+label (`shrink-0`), `content` (`min-h-0 flex-1 overflow-y-auto`), nav (`shrink-0 border-t`) — el consumidor NUNCA debe envolver `<Wizard>` en un contenedor que ya scrollea por su cuenta, porque entonces scrollea dos veces (una el wrapper, otra el `content` interno). Por eso el `<SidePanel>` que lo hospeda necesita `bodyClassName="flex min-h-0 flex-1 flex-col"` (sin el `overflow-y-auto`/padding default de `SidePanel`, ver el JSDoc de esa prop en `side-panel.tsx` y el uso ya existente en `orders/index.tsx` con `OrderDetailPanel`, mismo patrón).
- **El último paso no recibe un botón de "completar" genérico a propósito**: el componente deja de renderizar "Siguiente" en el último paso. Si ese paso necesita una acción final (un "Guardar" simple, o dos como "Guardar borrador"/"Guardar y publicar" en productos — ver `mangiar-menu`), se pasa en `WizardStep.footer` — **nunca metida dentro de `content`**, porque `content` es lo único que scrollea y el pedido explícito fue que los botones de acción queden siempre fijos abajo junto con "Atrás". `footer` reemplaza solo el lado derecho de la barra de navegación (el "Siguiente" de ese paso); "Atrás"/"Cancelar" del lado izquierdo siguen apareciendo igual, así se puede volver a un paso anterior incluso parado en el último. No agregar un prop `onComplete`/`completeLabel` genérico — ya se descartó ese diseño una vez (antes de que existiera `footer`) por ser demasiado rígido para acciones finales que varían por formulario.
- Estado del paso actual es interno (`useState`, no controlado) — no hay prop `step`/`onStepChange` todavía porque ningún consumidor necesitó controlarlo desde afuera. Si hace falta (ej. saltar a un paso específico por un link externo), agregarlo ahí sin romper el uso no controlado existente.

## Componentes y estilos

- Componentes de UI propios en Tailwind v4 (`apps/app/src/components/ui/`) — **nunca** shadcn/ui, es una decisión de proyecto de larga data.
- **Color de marca**: `red-500` (paleta default de Tailwind, sin token custom) es el rojo principal — se usa en toda acción principal/positiva (`<Button>` sin `variant`, ej. "Guardar cambios", "Cerrar orden", "Confirmar pago", "Cobrar") y en el fondo del sidebar de Configuración. Ver `apps/app/src/components/ui/button.tsx`: el variant `default` es `bg-red-500 text-white hover:bg-red-600`.
- **Botones destructivos** (`variant="destructive"`, ej. "Eliminar X") usan `red-700` (un escalón más oscuro que el `red-500` primario, para no confundirse con una acción positiva) y **siempre** muestran un ícono de tacho (`Trash2` de lucide-react) — lo agrega automáticamente el componente `Button` cuando `variant === "destructive"`, no hace falta (ni se debe) pasarlo a mano en los `children`.
- **Ninguna eliminación dispara sin confirmar antes** (regla cross-cutting, ver `CLAUDE.md` para el detalle y qué pantallas todavía faltan migrar) — el patrón es una confirmación inline dentro del mismo panel (ghost "No" / destructive "Sí, eliminar"), no un `window.confirm()` ni un modal.
- Una acción de "cerrar/confirmar" (ej. "Cerrar caja") no es destructiva aunque termine una sesión — usa el variant `default` (rojo de marca), no `destructive`. El criterio es: ¿borra o elimina algo? → `destructive`. ¿Confirma, cierra o guarda? → `default`.
- Solo modo claro: `color-scheme: light` fijo en `index.css` (no `light dark`). El bug real que esto arregló: con `light dark` + un OS en modo oscuro, inputs con `bg-white` hardcodeado mostraban texto blanco sobre blanco invisible. La app no tiene soporte de dark mode, no agregarlo a medias.
- Labels de UI siempre en español (incluyendo unidades: "Kilogramo" no "Kilogram", etc.) — convención confirmada explícitamente por el usuario para toda la interfaz, no solo para inventario donde se pidió primero.

## Formularios y staff-attribution

Toda entidad que registra una acción de un empleado (movimiento de caja, gasto, apertura/cierre de sesión) tiene un campo opcional `xById` que default-ea a `currentUserId` pero se puede sobreescribir con el componente `<StaffPicker value={...} onChange={...} />` (`apps/app/src/components/staff/StaffPicker.tsx`), validado server-side contra el roster del restaurante.

## Formato de precios y montos

- Todo valor monetario que se muestra en la UI pasa por `formatPrice()` (`apps/app/src/lib/currency.ts`) — nunca interpolar el valor crudo (`` `$${value}` ``) ni usar `.toFixed(2)` a mano. Formato argentino: separador de miles `.`, coma decimal solo cuando hay centavos (`4000` → `"$4.000"`, `7500.20` → `"$7.500,20"`), negativos como `"-$X"` (nunca `"$-X"`) — pedido explícito del usuario para normalizar cómo se ven los precios en toda la app.
- `formatPrice()` ya incluye el signo `$` en el resultado — no agregarlo de nuevo en el JSX que lo llama (`{formatPrice(value)}`, no `` `${formatPrice(value)}` ``).
- Es una función plana, deliberadamente **no** un hook de React (`useX`), para poder llamarla también dentro de `cell: ({ row }) => ...` de columnas de `DataTable` y otros callbacks fuera de un componente, donde no se pueden invocar hooks.

## Inputs numéricos no escuchan scroll

Todo `<input type="number">` pasa por el componente compartido `<Input>` (`apps/app/src/components/ui/input.tsx`), que ya intercepta el evento `wheel` y hace `blur()` del input cuando `type === "number"` — así el scroll del mouse nunca cambia el valor por accidente (pedido explícito del usuario, por el riesgo de errores silenciosos en montos/cantidades). Si se agrega un input numérico nuevo, alcanza con usar `<Input type="number" />`; no hace falta (ni se debe) agregar un `onWheel` manual por componente.

## Guards de módulo en UI

`<ModuleGuard module={Module.X}>` envuelve el componente de una ruta entera cuando la feature completa depende de un módulo opcional (ej. `/expenses`, `/invoices`); dentro de una página CORE que solo tiene un paso opcionalmente potenciado (ej. `/orders` con el botón "Facturar"), se usa `hasModule()` inline para mostrar/ocultar ese fragmento puntual en vez de gatear la página entera.
