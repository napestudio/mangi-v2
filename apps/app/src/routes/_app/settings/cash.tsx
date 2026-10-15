import { useState } from "react";
import { Module } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface SectorRef {
  sector: { id: string; name: string };
}

interface CashRegisterItem {
  id: string;
  name: string;
  isActive: boolean;
  sectors: SectorRef[];
}

interface SectorItem {
  id: string;
  name: string;
}

export const Route = createFileRoute("/_app/settings/cash")({
  component: () => (
    <ModuleGuard module={Module.CASH}>
      <CashSettingsPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<CashRegisterItem>[] = [
  { accessorKey: "name", header: "Caja" },
  {
    id: "sectors",
    header: "Sectores",
    cell: ({ row }) => row.original.sectors.map((s) => s.sector.name).join(", ") || "—",
  },
];

function CashSettingsPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<CashRegisterItem>();

  const [creatingRegister, setCreatingRegister] = useState(false);
  const [newRegisterName, setNewRegisterName] = useState("");
  const [newRegisterSectorIds, setNewRegisterSectorIds] = useState<string[]>([]);

  const [editName, setEditName] = useState("");
  const [editSectorIds, setEditSectorIds] = useState<string[]>([]);
  const [prevSelected, setPrevSelected] = useState(panel.selected);

  if (panel.selected !== prevSelected) {
    setPrevSelected(panel.selected);
    setEditName(panel.selected?.name ?? "");
    setEditSectorIds(panel.selected?.sectors.map((s) => s.sector.id) ?? []);
  }

  const { data: registers, isLoading } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashRegisterItem[]>>("/cash-registers");
      return data.data;
    },
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SectorItem[]>>("/sectors");
      return data.data;
    },
  });

  const createRegister = useMutation({
    mutationFn: async () => {
      await apiClient.post("/cash-registers", { name: newRegisterName, sectorIds: newRegisterSectorIds });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setCreatingRegister(false);
      setNewRegisterName("");
      setNewRegisterSectorIds([]);
    },
  });

  const updateRegister = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/cash-registers/${panel.selected!.id}`, { name: editName, sectorIds: editSectorIds });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      panel.close();
    },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Cajas</h1>
        {!creatingRegister && (
          <Button size="sm" variant="outline" onClick={() => setCreatingRegister(true)}>
            <Plus className="h-4 w-4" /> Caja
          </Button>
        )}
      </div>

      {creatingRegister && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="registerName">Nombre</Label>
              <Input
                id="registerName"
                autoFocus
                value={newRegisterName}
                onChange={(event) => setNewRegisterName(event.target.value)}
                className="h-9 w-48"
              />
            </div>
            <Button size="sm" disabled={!newRegisterName.trim() || createRegister.isPending} onClick={() => createRegister.mutate()}>
              Crear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreatingRegister(false)}>
              Cancelar
            </Button>
          </div>
          {sectors && sectors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sectors.map((sector) => (
                <label key={sector.id} className="flex items-center gap-1.5 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={newRegisterSectorIds.includes(sector.id)}
                    onChange={(event) =>
                      setNewRegisterSectorIds((prev) =>
                        event.target.checked ? [...prev, sector.id] : prev.filter((id) => id !== sector.id),
                      )
                    }
                  />
                  {sector.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={registers ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay cajas todavía."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.name}>
        {panel.selected && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editRegisterName">Nombre</Label>
              <Input id="editRegisterName" value={editName} onChange={(event) => setEditName(event.target.value)} />
            </div>
            {sectors && sectors.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Sectores</Label>
                <div className="flex flex-wrap gap-2">
                  {sectors.map((sector) => (
                    <label key={sector.id} className="flex items-center gap-1.5 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={editSectorIds.includes(sector.id)}
                        onChange={(event) =>
                          setEditSectorIds((prev) =>
                            event.target.checked ? [...prev, sector.id] : prev.filter((id) => id !== sector.id),
                          )
                        }
                      />
                      {sector.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Button
              size="sm"
              className="self-start"
              disabled={!editName.trim() || updateRegister.isPending}
              onClick={() => updateRegister.mutate()}
            >
              Guardar
            </Button>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
