import { useEffect, useState } from "react";
import { Module, TableStatus } from "@mangiar/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { FloorPlanCanvas, type FloorPlanTable } from "@/components/salon/FloorPlanCanvas";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useCurrentUser } from "@/hooks/useAuth";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { connectSocket, disconnectSocket } from "@/lib/socket";

interface SectorItem {
  id: string;
  name: string;
  color: string | null;
  canvasWidth: number | null;
  canvasHeight: number | null;
}

const STATUS_LABELS: Record<TableStatus, string> = {
  [TableStatus.EMPTY]: "Libre",
  [TableStatus.OCCUPIED]: "Ocupada",
  [TableStatus.RESERVED]: "Reservada",
  [TableStatus.CLEANING]: "Limpieza",
  [TableStatus.PAYING]: "Pagando",
};

export const Route = createFileRoute("/_app/salon/")({
  component: () => (
    <ModuleGuard module={Module.SALON}>
      <SalonPage />
    </ModuleGuard>
  ),
});

function SalonPage() {
  const { restaurant } = useCurrentUser();
  const queryClient = useQueryClient();
  const panel = useSidePanel<FloorPlanTable>();

  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SectorItem[]>>("/sectors");
      return data.data;
    },
  });

  useEffect(() => {
    if (!selectedSectorId && sectors && sectors.length > 0) {
      setSelectedSectorId(sectors[0]!.id);
    }
  }, [sectors, selectedSectorId]);

  const { data: tables } = useQuery({
    queryKey: ["tables", selectedSectorId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<FloorPlanTable[]>>("/tables", {
        params: { sectorId: selectedSectorId },
      });
      return data.data;
    },
    enabled: !!selectedSectorId,
  });

  useEffect(() => {
    if (!restaurant?.id) return;
    const socket = connectSocket(restaurant.id);

    const handleStatusChanged = (payload: { id: string; status: TableStatus }) => {
      queryClient.setQueryData<FloorPlanTable[]>(["tables", selectedSectorId], (prev) =>
        prev?.map((table) => (table.id === payload.id ? { ...table, status: payload.status } : table)),
      );
    };

    socket.on("table:status_changed", handleStatusChanged);
    return () => {
      socket.off("table:status_changed", handleStatusChanged);
      disconnectSocket();
    };
  }, [restaurant?.id, selectedSectorId, queryClient]);

  const setTableStatus = (tableId: string, status: TableStatus) => {
    if (!restaurant?.id) return;
    connectSocket(restaurant.id).emit("table:update_status", { restaurantId: restaurant.id, tableId, status });
  };

  const selectedSector = sectors?.find((sector) => sector.id === selectedSectorId);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Salón</h1>
        <Link
          to="/settings/map"
          title="Editar mapa"
          aria-label="Editar mapa"
          className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sectors?.map((sector) => (
          <button
            key={sector.id}
            type="button"
            onClick={() => setSelectedSectorId(sector.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium",
              sector.id === selectedSectorId
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
            )}
          >
            {sector.name}
          </button>
        ))}
      </div>

      {selectedSector && (
        <FloorPlanCanvas
          canvasWidth={selectedSector.canvasWidth ?? 1000}
          canvasHeight={selectedSector.canvasHeight ?? 600}
          tables={tables ?? []}
          onTableClick={panel.open}
        />
      )}

      {sectors && sectors.length === 0 && (
        <p className="text-sm text-neutral-500">
          Todavía no hay sectores configurados.{" "}
          <Link to="/settings/map" className="font-medium text-neutral-900 underline">
            Configurá el mapa del salón
          </Link>
          .
        </p>
      )}

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected ? `Mesa ${panel.selected.number}` : ""}>
        {panel.selected && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-medium uppercase text-neutral-500">Capacidad</p>
              <p className="text-sm text-neutral-900">{panel.selected.capacity} personas</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Estado</p>
              <div className="flex flex-wrap gap-2">
                {Object.values(TableStatus).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setTableStatus(panel.selected!.id, status)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm",
                      status === panel.selected!.status
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
