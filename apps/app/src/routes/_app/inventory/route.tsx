import { Module } from "@mangiar/shared";
import { Link, Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { cn } from "@/lib/utils";

const INVENTORY_NAV_ITEMS = [
  { label: "Stock de productos", to: "/inventory/stock" },
  { label: "Stock de ingredientes", to: "/inventory/ingredient-stock" },
];

export const Route = createFileRoute("/_app/inventory")({
  component: () => (
    <ModuleGuard module={Module.INVENTORY}>
      <InventoryLayout />
    </ModuleGuard>
  ),
});

function InventoryLayout() {
  const matchRoute = useMatchRoute();

  return (
    <div className="flex h-full gap-8">
      <aside className="w-48 shrink-0 rounded-2xl bg-red-500 p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-white/70">
          Inventario
        </p>
        <nav className="flex flex-col gap-1">
          {INVENTORY_NAV_ITEMS.map((item) => {
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
