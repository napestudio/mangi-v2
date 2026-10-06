import { useState } from "react";
import { isAxiosError } from "axios";
import { Module, TableShape } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { FloorPlanCanvas, type FloorPlanTable } from "@/components/salon/FloorPlanCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

interface SectorItem {
  id: string;
  name: string;
  color: string | null;
  canvasWidth: number | null;
  canvasHeight: number | null;
}

const SHAPE_LABELS: Record<TableShape, string> = {
  [TableShape.SQUARE]: "Cuadrada",
  [TableShape.RECTANGLE]: "Rectangular",
  [TableShape.CIRCLE]: "Redonda",
  [TableShape.WIDE]: "Ancha",
};

export const Route = createFileRoute("/_app/settings/map")({
  component: () => (
    <ModuleGuard module={Module.SALON}>
      <MapSettingsPage />
    </ModuleGuard>
  ),
});

function MapSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const tablePanel = useSidePanel<FloorPlanTable>();

  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [sectorFormMode, setSectorFormMode] = useState<"none" | "create" | "edit">("none");
  const [sectorName, setSectorName] = useState("");
  const [sectorColor, setSectorColor] = useState("#3b82f6");
  const [confirmingDeleteSector, setConfirmingDeleteSector] = useState(false);
  const [confirmingDeleteTable, setConfirmingDeleteTable] = useState(false);

  const [tableForm, setTableForm] = useState({ number: "", capacity: 2, shape: TableShape.SQUARE as TableShape });
  const [prevSelectedTable, setPrevSelectedTable] = useState(tablePanel.selected);

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SectorItem[]>>("/sectors");
      return data.data;
    },
  });

  if (!selectedSectorId && sectors && sectors.length > 0) {
    setSelectedSectorId(sectors[0]!.id);
  }

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

  // Todas las mesas del restaurante (todos los sectores), solo para calcular el próximo número libre.
  const { data: allTables } = useQuery({
    queryKey: ["tables", "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<FloorPlanTable[]>>("/tables");
      return data.data;
    },
  });

  if (tablePanel.selected !== prevSelectedTable) {
    setPrevSelectedTable(tablePanel.selected);
    if (tablePanel.selected) {
      setTableForm({
        number: tablePanel.selected.number,
        capacity: tablePanel.selected.capacity,
        shape: tablePanel.selected.shape,
      });
      setConfirmingDeleteTable(false);
    }
  }

  const createSector = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiEnvelope<SectorItem>>("/sectors", { name: sectorName, color: sectorColor });
      return data.data;
    },
    onSuccess: (sector) => {
      void queryClient.invalidateQueries({ queryKey: ["sectors"] });
      setSelectedSectorId(sector.id);
      closeSectorForm();
    },
  });

  const updateSector = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/sectors/${selectedSectorId}`, { name: sectorName, color: sectorColor });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sectors"] });
      closeSectorForm();
    },
  });

  const deleteSector = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/sectors/${selectedSectorId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sectors"] });
      setSelectedSectorId(null);
      setConfirmingDeleteSector(false);
    },
  });

  const createTable = useMutation({
    mutationFn: async () => {
      const highestNumber = (allTables ?? []).reduce((max, table) => {
        const parsed = Number.parseInt(table.number, 10);
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0);
      const { data } = await apiClient.post<ApiEnvelope<FloorPlanTable>>("/tables", {
        sectorId: selectedSectorId,
        number: String(highestNumber + 1),
        capacity: 2,
        posX: 40,
        posY: 40,
      });
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables", selectedSectorId] });
      void queryClient.invalidateQueries({ queryKey: ["tables", "all"] });
    },
    onError: (error) => {
      toast.show({ message: extractErrorMessage(error, "No se pudo crear la mesa"), variant: "error" });
    },
  });

  const moveTable = useMutation({
    mutationFn: async ({ id, posX, posY }: { id: string; posX: number; posY: number }) => {
      await apiClient.patch(`/tables/${id}/position`, { posX, posY });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables", selectedSectorId] });
    },
  });

  const updateTable = useMutation({
    mutationFn: async () => {
      if (!tablePanel.selected) return;
      await apiClient.patch(`/tables/${tablePanel.selected.id}`, tableForm);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables", selectedSectorId] });
      void queryClient.invalidateQueries({ queryKey: ["tables", "all"] });
      tablePanel.close();
    },
    onError: (error) => {
      toast.show({ message: extractErrorMessage(error, "No se pudo guardar la mesa"), variant: "error" });
    },
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tables/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables", selectedSectorId] });
      void queryClient.invalidateQueries({ queryKey: ["tables", "all"] });
      setConfirmingDeleteTable(false);
      tablePanel.close();
    },
    onError: (error) => {
      setConfirmingDeleteTable(false);
      toast.show({ message: extractErrorMessage(error, "No se pudo eliminar la mesa"), variant: "error" });
    },
  });

  function openCreateSectorForm() {
    setSectorName("");
    setSectorColor("#3b82f6");
    setSectorFormMode("create");
  }

  function openEditSectorForm() {
    if (!selectedSector) return;
    setSectorName(selectedSector.name);
    setSectorColor(selectedSector.color ?? "#3b82f6");
    setSectorFormMode("edit");
  }

  function closeSectorForm() {
    setSectorFormMode("none");
    setConfirmingDeleteSector(false);
  }

  const selectedSector = sectors?.find((sector) => sector.id === selectedSectorId);

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Configuración del mapa</h1>

      <div className="flex flex-wrap items-center gap-2">
        {sectors?.map((sector) => (
          <button
            key={sector.id}
            type="button"
            onClick={() => {
              setSelectedSectorId(sector.id);
              closeSectorForm();
            }}
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

        {selectedSector && sectorFormMode === "none" && (
          <>
            <Button size="sm" variant="ghost" onClick={openEditSectorForm}>
              <Pencil className="h-4 w-4" />
            </Button>
            {confirmingDeleteSector ? (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-neutral-600">¿Eliminar sector?</span>
                <Button size="sm" variant="destructive" onClick={() => deleteSector.mutate()}>
                  Sí
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDeleteSector(false)}>
                  No
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDeleteSector(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {sectorFormMode === "none" && (
          <Button size="sm" variant="outline" onClick={openCreateSectorForm}>
            <Plus className="h-4 w-4" /> Sector
          </Button>
        )}
      </div>

      {sectorFormMode !== "none" && (
        <div className="flex items-end gap-2 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sectorName">Nombre</Label>
            <Input
              id="sectorName"
              autoFocus
              value={sectorName}
              onChange={(event) => setSectorName(event.target.value)}
              className="h-9 w-48"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sectorColor">Color</Label>
            <input
              id="sectorColor"
              type="color"
              value={sectorColor}
              onChange={(event) => setSectorColor(event.target.value)}
              className="h-9 w-14 rounded-md border border-neutral-300"
            />
          </div>
          <Button
            size="sm"
            disabled={!sectorName.trim() || createSector.isPending || updateSector.isPending}
            onClick={() => (sectorFormMode === "create" ? createSector.mutate() : updateSector.mutate())}
          >
            {sectorFormMode === "create" ? "Crear" : "Guardar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={closeSectorForm}>
            Cancelar
          </Button>
        </div>
      )}

      {selectedSector && (
        <>
          <div>
            <Button size="sm" onClick={() => createTable.mutate()} disabled={createTable.isPending}>
              <Plus className="h-4 w-4" /> Mesa
            </Button>
          </div>
          <FloorPlanCanvas
            canvasWidth={selectedSector.canvasWidth ?? 1000}
            canvasHeight={selectedSector.canvasHeight ?? 600}
            tables={tables ?? []}
            editable
            onTableClick={tablePanel.open}
            onTableMoved={(id, posX, posY) => moveTable.mutate({ id, posX, posY })}
          />
        </>
      )}

      {sectors && sectors.length === 0 && sectorFormMode === "none" && (
        <p className="text-sm text-neutral-500">Creá un sector para empezar a agregar mesas.</p>
      )}

      <SidePanel
        open={tablePanel.isOpen}
        onClose={tablePanel.close}
        title={tablePanel.selected ? `Mesa ${tablePanel.selected.number}` : ""}
      >
        {tablePanel.selected && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tableNumber">Número</Label>
              <Input
                id="tableNumber"
                value={tableForm.number}
                onChange={(event) => setTableForm((prev) => ({ ...prev, number: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tableCapacity">Capacidad</Label>
              <Input
                id="tableCapacity"
                type="number"
                min={1}
                value={tableForm.capacity}
                onChange={(event) => setTableForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tableShape">Forma</Label>
              <select
                id="tableShape"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                value={tableForm.shape}
                onChange={(event) => setTableForm((prev) => ({ ...prev, shape: event.target.value as TableShape }))}
              >
                {Object.values(TableShape).map((shape) => (
                  <option key={shape} value={shape}>
                    {SHAPE_LABELS[shape]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => updateTable.mutate()} disabled={updateTable.isPending}>
                Guardar
              </Button>
              {confirmingDeleteTable ? (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-neutral-600">¿Eliminar mesa?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteTable.mutate(tablePanel.selected!.id)}
                    disabled={deleteTable.isPending}
                  >
                    Sí
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingDeleteTable(false)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setConfirmingDeleteTable(true)}>
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
