import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { ActiveOrderPanel } from "@/components/salon/ActiveOrderPanel";
import {
  FloorPlanCanvas,
  type FloorPlanTable,
} from "@/components/salon/FloorPlanCanvas";
import { OpenTableForm } from "@/components/salon/OpenTableForm";
import { patchTableStatus } from "@/components/salon/tableCache";
import { useSidePanel } from "@/components/ui/side-panel";
import { useCurrentUser } from "@/hooks/useAuth";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Module, TableStatus } from "@mangiar/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Table2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface SectorItem {
  id: string;
  name: string;
  color: string | null;
  canvasWidth: number | null;
  canvasHeight: number | null;
}

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
      const { data } =
        await apiClient.get<ApiEnvelope<SectorItem[]>>("/sectors");
      return data.data;
    },
  });

  if (!selectedSectorId && sectors && sectors.length > 0) {
    setSelectedSectorId(sectors[0]!.id);
  }

  const { data: tables } = useQuery({
    queryKey: ["tables", selectedSectorId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<FloorPlanTable[]>>(
        "/tables",
        {
          params: { sectorId: selectedSectorId },
        },
      );
      return data.data;
    },
    enabled: !!selectedSectorId,
  });

  // Reuses the shared socket connection for the whole session — only attaches/detaches
  // this listener here, never connects/disconnects the socket itself (that would tear it
  // down for AppShell's print:job listener too). See ActiveOrderPanel for the same pattern.
  useEffect(() => {
    if (!restaurant?.id) return;
    const socket = connectSocket(restaurant.id);

    const handleStatusChanged = (payload: {
      id: string;
      status: TableStatus;
    }) => {
      patchTableStatus(queryClient, payload.id, payload.status);
    };
    // order:updated/deleted don't carry a tableId (see ActiveOrderPanel) — refetch the
    // sector's table list unfiltered so the floor plan's active-order dots stay accurate.
    const refetchTables = () => {
      void queryClient.invalidateQueries({
        queryKey: ["tables", selectedSectorId],
      });
    };

    socket.on("table:status_changed", handleStatusChanged);
    socket.on("order:created", refetchTables);
    socket.on("order:updated", refetchTables);
    socket.on("order:deleted", refetchTables);
    return () => {
      socket.off("table:status_changed", handleStatusChanged);
      socket.off("order:created", refetchTables);
      socket.off("order:updated", refetchTables);
      socket.off("order:deleted", refetchTables);
    };
  }, [restaurant?.id, queryClient, selectedSectorId]);

  const selectedSector = sectors?.find(
    (sector) => sector.id === selectedSectorId,
  );
  const liveSelected = panel.selected
    ? (tables?.find((table) => table.id === panel.selected!.id) ??
      panel.selected)
    : null;

  return (
    <div className="flex h-full flex-col gap-4">
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

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-1 overflow-auto">
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
              <Link
                to="/settings/map"
                className="font-medium text-neutral-900 underline"
              >
                Configurá el mapa del salón
              </Link>
              .
            </p>
          )}
        </div>

        <aside className="flex w-full max-w-sm shrink-0 flex-col rounded-lg border border-neutral-200 bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div className="text-lg font-semibold text-neutral-900">
              {liveSelected ? `Mesa ${liveSelected.number}` : ""}
            </div>
            {liveSelected && (
              <button
                type="button"
                onClick={panel.close}
                aria-label="Cerrar"
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex flex-1 min-h-0 flex-col px-6 pt-4">
            {liveSelected && selectedSectorId ? (
              liveSelected.status === TableStatus.EMPTY ? (
                <div className="overflow-y-auto">
                  <OpenTableForm table={liveSelected} />
                </div>
              ) : (
                <ActiveOrderPanel
                  table={liveSelected}
                  onClosePanel={panel.close}
                  className="flex-1 min-h-0"
                />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-neutral-400">
                <Table2 className="h-16 w-16" />
                <p className="text-sm">No hay mesas seleccionadas</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
