import { useEffect } from "react";
import type { BusinessHoursStatus } from "@mangiar/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  Armchair,
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Module } from "@mangiar/shared";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  module?: Module;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Pedidos", to: "/orders", icon: ClipboardList },
  { label: "Venta rápida", to: "/pos/counter", icon: ShoppingBag },
  { label: "Menú", to: "/menu/products", icon: UtensilsCrossed },
  { label: "Salón", to: "/salon", icon: Armchair, module: Module.SALON },
  { label: "Reservas", to: "/reservations", icon: CalendarClock, module: Module.RESERVATIONS },
  { label: "Inventario", to: "/inventory/ingredients", icon: Package, module: Module.INVENTORY },
  { label: "Proveedores", to: "/suppliers", icon: Truck, module: Module.SUPPLIERS },
  { label: "Caja", to: "/cash", icon: Wallet, module: Module.CASH },
  { label: "Gastos", to: "/expenses", icon: Receipt, module: Module.EXPENSES },
  { label: "Facturas", to: "/invoices", icon: FileText, module: Module.FISCAL },
  { label: "Configuración", to: "/settings/restaurant", icon: Settings },
];

export function AppShell() {
  const { user, restaurant } = useCurrentUser();
  const { hasModule } = useModules();
  const navigate = useNavigate();
  const logout = useLogout();
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.module || hasModule(item.module));

  const { data: hoursStatus } = useQuery({
    queryKey: ["business-hours-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<BusinessHoursStatus>>("/business-hours/status");
      return data.data;
    },
    refetchInterval: 60_000,
  });

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate({ to: "/login" }),
    });
  };

  useEffect(() => {
    if (!restaurant?.id) return;

    const socket = connectSocket(restaurant.id);
    const handlePrintJob = ({ printJob }: { printJob: unknown }) => {
      const accessToken = useAuthStore.getState().accessToken;
      void window.electron?.print?.job(printJob, accessToken);
    };
    socket.on("print:job", handlePrintJob);

    return () => {
      socket.off("print:job", handlePrintJob);
    };
  }, [restaurant?.id]);

  return (
    <div className="flex h-screen flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-neutral-900">{restaurant?.name ?? "Mangiar"}</p>
          {hoursStatus && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                hoursStatus.isOpen ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600",
              )}
            >
              {hoursStatus.isOpen ? "Abierto" : "Cerrado"}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md text-neutral-500",
                "hover:bg-neutral-100 hover:text-neutral-900",
              )}
              activeProps={{ className: "bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white" }}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-3">
          <span className="hidden truncate text-sm text-neutral-500 sm:inline">{user?.username}</span>
          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
