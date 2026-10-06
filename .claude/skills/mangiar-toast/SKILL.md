---
name: mangiar-toast
description: Toasts (notificaciones transitorias) de Mangiar v2. Usar al mostrar una confirmación o error no bloqueante tras una acción, o al extender el componente (posición, variantes, duración, stacking).
---

# Mangiar v2 — Toast

Componente propio de feedback transitorio (éxito/error/info) que aparece sobre la UI y se auto-descarta. Ver `mangiar-ui-ux` para el resto de convenciones visuales.

## Mapa de archivos

- **Componente**: `apps/app/src/components/ui/toast.tsx` — exporta `ToastProvider` y el hook `useToast()`.
- **Montaje**: `apps/app/src/main.tsx`, envolviendo `<RouterProvider>` dentro de `<QueryClientProvider>` — hay un único `ToastProvider` global, no instanciar uno por pantalla.
- **Consumidores**: `apps/app/src/components/salon/MoveOrderTablePicker.tsx` (confirma "Pedido movido a Mesa N" al mover una orden entre mesas) y `apps/app/src/routes/_app/settings/map.tsx` (error al fallar el borrado de una mesa/sector). Antes de agregar un mecanismo de notificación nuevo en cualquier módulo, revisar si esto ya cubre el caso.

## Decisiones y convenciones

- **Por qué es custom**: convención de larga data del proyecto — nunca librerías de UI externas (ver `feedback_no_shadcn` en memoria, y `mangiar-ui-ux`). Todo en `components/ui/` es Tailwind v4 escrito a mano.
- **Patrón de portal**: igual que `SidePanel` (`apps/app/src/components/ui/side-panel.tsx`) — `createPortal(..., document.body)`, no un overlay dentro del árbol normal de la app.
- **API**: `useToast()` devuelve `{ show(options), dismiss(id) }`. `show({message, variant?, duration?})` — `variant` es `"success" | "error" | "info"` (default `"info"`), `duration` en ms (default ~4000). `show` devuelve el `id` del toast por si se quiere descartar manualmente antes de que expire.
- **Colores por variante**: fijos en el archivo (`VARIANT_STYLES`), no son una prop en cada llamada — hoy ningún consumidor necesita un color distinto por instancia. Si llega a hacer falta, agregar una prop `variant` custom ahí es trivial, pero no construir esa API hasta que haya un caso real.
- **Posición**: sí es configurable, pero a nivel de `ToastProvider` (prop `position`, default `"bottom-right"`), no por llamada individual — es la única personalización con un consumidor real (distintas pantallas podrían preferir otra esquina), así que vive en el único lugar donde se monta el provider.
- **No bloquea**: el toast es feedback posterior a una acción ya ejecutada (o su error), nunca un paso de confirmación en sí mismo. Si hace falta preguntarle algo al usuario antes de ejecutar una acción (ej. "¿mover igual a una mesa ocupada?"), eso se resuelve con una vista intermedia dentro del flujo mismo (mismo patrón que `CloseTableCheckout`/`MoveOrderTablePicker` reemplazando el cuerpo de un panel) — no con el toast.

## Limitaciones conocidas

- Sin límite de cantidad de toasts apilados simultáneamente — si se dispara un alud de `show()` en poco tiempo, se apilan todos sin agrupar ni reemplazar. No fue un problema real todavía.
- Sin soporte de acciones dentro del toast (ej. un botón "Deshacer") — si se pide, es `ToastOptions` nuevo (ej. `action?: {label, onClick}`) más el render del botón, trabajo no hecho todavía.
- Sin tests. Si se modifica la lógica de auto-dismiss/stacking, probar a mano abriendo varios toasts seguidos y confirmando que cada uno respeta su propio timer.
