import { Module } from "@mangiar/shared";
import { Link, Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import { useModules } from "@/hooks/useModules";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  label: string;
  to: string;
  module?: Module;
}

const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { label: "Restaurante", to: "/settings/restaurant" },
  { label: "Salón", to: "/settings/map", module: Module.SALON },
  {
    label: "Reservas",
    to: "/settings/reservations",
    module: Module.RESERVATIONS,
  },
  { label: "Delivery", to: "/settings/delivery", module: Module.DELIVERY },
  { label: "Facturación", to: "/settings/fiscal", module: Module.FISCAL },
  { label: "Impresión", to: "/settings/printing", module: Module.PRINTING },
];

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { hasModule } = useModules();
  const matchRoute = useMatchRoute();
  const visibleItems = SETTINGS_NAV_ITEMS.filter(
    (item) => !item.module || hasModule(item.module),
  );

  return (
    <div className="flex h-full gap-8">
      <aside className="w-48 shrink-0 rounded-2xl bg-red-500 p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-white/70">
          Configuración
        </p>
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const isActive = !!matchRoute({ to: item.to, fuzzy: true });
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  isActive ? "bg-white text-red-500" : "text-white hover:bg-white/10",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
