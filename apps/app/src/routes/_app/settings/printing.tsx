import { useState } from "react";
import { PrinterConnectionType, PrintMode } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CategoryOption {
  id: string;
  name: string;
}

interface StationItem {
  id: string;
  name: string;
  color: string | null;
  categories: { category: CategoryOption }[];
  printers: { id: string; name: string }[];
}

interface PrinterItem {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress: string | null;
  port: number | null;
  usbPath: string | null;
  printMode: PrintMode;
  status: "ONLINE" | "OFFLINE" | "ERROR";
  isActive: boolean;
  stationId: string | null;
}

const PRINT_MODE_LABELS: Record<PrintMode, string> = {
  [PrintMode.STATION_ITEMS]: "Solo items de la estación",
  [PrintMode.FULL_ORDER]: "Pedido completo (recibo)",
  [PrintMode.BOTH]: "Ambos",
};

const STATUS_STYLES: Record<PrinterItem["status"], string> = {
  ONLINE: "bg-emerald-100 text-emerald-800",
  OFFLINE: "bg-neutral-200 text-neutral-600",
  ERROR: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<PrinterItem["status"], string> = {
  ONLINE: "En línea",
  OFFLINE: "Sin conexión",
  ERROR: "Error",
};

interface StationFormState {
  name: string;
  color: string;
  categoryIds: string[];
}

function emptyStationForm(): StationFormState {
  return { name: "", color: "", categoryIds: [] };
}

interface PrinterFormState {
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress: string;
  port: string;
  usbPath: string;
  printMode: PrintMode;
  stationId: string;
}

function emptyPrinterForm(): PrinterFormState {
  return { name: "", connectionType: PrinterConnectionType.NETWORK, ipAddress: "", port: "9100", usbPath: "", printMode: PrintMode.FULL_ORDER, stationId: "" };
}

export const Route = createFileRoute("/_app/settings/printing")({
  component: PrintingSettingsPage,
});

function PrintingSettingsPage() {
  const queryClient = useQueryClient();
  const stationPanel = useSidePanel<PrinterItem>();

  const [creatingStation, setCreatingStation] = useState(false);
  const [stationForm, setStationForm] = useState<StationFormState>(emptyStationForm());
  const [creatingPrinter, setCreatingPrinter] = useState(false);
  const [printerForm, setPrinterForm] = useState<PrinterFormState>(emptyPrinterForm());

  const { data: stations, isLoading: stationsLoading } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<StationItem[]>>("/stations");
      return data.data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CategoryOption[]>>("/categories");
      return data.data;
    },
  });

  const { data: printers, isLoading: printersLoading } = useQuery({
    queryKey: ["printers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<PrinterItem[]>>("/printers");
      return data.data;
    },
  });

  const createStation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/stations", stationForm);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stations"] });
      setCreatingStation(false);
      setStationForm(emptyStationForm());
    },
  });

  const removeStation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/stations/${id}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["stations"] }),
  });

  const createPrinter = useMutation({
    mutationFn: async () => {
      await apiClient.post("/printers", {
        name: printerForm.name,
        connectionType: printerForm.connectionType,
        ipAddress: printerForm.connectionType === PrinterConnectionType.NETWORK ? printerForm.ipAddress : undefined,
        port: printerForm.connectionType === PrinterConnectionType.NETWORK ? Number(printerForm.port || 9100) : undefined,
        usbPath: printerForm.connectionType === PrinterConnectionType.USB ? printerForm.usbPath : undefined,
        printMode: printerForm.printMode,
        stationId: printerForm.stationId || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      setCreatingPrinter(false);
      setPrinterForm(emptyPrinterForm());
    },
  });

  const removePrinter = useMutation({
    mutationFn: async () => {
      if (!stationPanel.selected) return;
      await apiClient.delete(`/printers/${stationPanel.selected.id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      stationPanel.close();
    },
  });

  const columns: ColumnDef<PrinterItem>[] = [
    { accessorKey: "name", header: "Nombre" },
    {
      id: "connection",
      header: "Conexión",
      cell: ({ row }) =>
        row.original.connectionType === PrinterConnectionType.NETWORK
          ? `Red · ${row.original.ipAddress}:${row.original.port}`
          : `USB · ${row.original.usbPath}`,
    },
    { id: "mode", header: "Imprime", cell: ({ row }) => PRINT_MODE_LABELS[row.original.printMode] },
    {
      id: "station",
      header: "Estación",
      cell: ({ row }) => stations?.find((station) => station.id === row.original.stationId)?.name ?? "—",
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[row.original.status])}>
          {STATUS_LABELS[row.original.status]}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Impresión</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Estaciones</h2>
          {!creatingStation && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStationForm(emptyStationForm());
                setCreatingStation(true);
              }}
            >
              <Plus className="h-4 w-4" /> Estación
            </Button>
          )}
        </div>

        {creatingStation && (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stationName">Nombre</Label>
                <Input
                  id="stationName"
                  autoFocus
                  value={stationForm.name}
                  onChange={(event) => setStationForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-9 w-48"
                />
              </div>
              <Button size="sm" disabled={!stationForm.name.trim() || createStation.isPending} onClick={() => createStation.mutate()}>
                Crear
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatingStation(false)}>
                Cancelar
              </Button>
            </div>
            {categories && categories.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-neutral-500">Categorías que imprime esta estación</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-1.5 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={stationForm.categoryIds.includes(category.id)}
                        onChange={(event) =>
                          setStationForm((prev) => ({
                            ...prev,
                            categoryIds: event.target.checked
                              ? [...prev.categoryIds, category.id]
                              : prev.categoryIds.filter((id) => id !== category.id),
                          }))
                        }
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {stationsLoading && <p className="text-sm text-neutral-500">Cargando...</p>}
          {!stationsLoading && stations?.length === 0 && <p className="text-sm text-neutral-500">No hay estaciones configuradas.</p>}
          {stations?.map((station) => (
            <div key={station.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">{station.name}</p>
                <p className="text-xs text-neutral-500">
                  {station.categories.map((entry) => entry.category.name).join(", ") || "Sin categorías asignadas"}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeStation.mutate(station.id)}>
                Eliminar
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Impresoras</h2>
          {!creatingPrinter && (
            <Button
              size="sm"
              onClick={() => {
                setPrinterForm(emptyPrinterForm());
                setCreatingPrinter(true);
              }}
            >
              <Plus className="h-4 w-4" /> Impresora
            </Button>
          )}
        </div>

        {creatingPrinter && (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre</Label>
                <Input value={printerForm.name} onChange={(event) => setPrinterForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tipo de conexión</Label>
                <select
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  value={printerForm.connectionType}
                  onChange={(event) =>
                    setPrinterForm((prev) => ({ ...prev, connectionType: event.target.value as PrinterConnectionType }))
                  }
                >
                  <option value={PrinterConnectionType.NETWORK}>Red (Ethernet o WiFi)</option>
                  <option value={PrinterConnectionType.USB}>USB</option>
                </select>
              </div>

              {printerForm.connectionType === PrinterConnectionType.NETWORK ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>Dirección IP</Label>
                    <Input
                      placeholder="192.168.0.50"
                      value={printerForm.ipAddress}
                      onChange={(event) => setPrinterForm((prev) => ({ ...prev, ipAddress: event.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Puerto</Label>
                    <Input
                      type="number"
                      value={printerForm.port}
                      onChange={(event) => setPrinterForm((prev) => ({ ...prev, port: event.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Nombre de la impresora en el sistema</Label>
                  <Input
                    placeholder="EPSON TM-T20III"
                    value={printerForm.usbPath}
                    onChange={(event) => setPrinterForm((prev) => ({ ...prev, usbPath: event.target.value }))}
                  />
                  <p className="text-xs text-neutral-500">Tal como aparece en las impresoras instaladas de Windows/macOS.</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Qué imprime</Label>
                <select
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  value={printerForm.printMode}
                  onChange={(event) => setPrinterForm((prev) => ({ ...prev, printMode: event.target.value as PrintMode }))}
                >
                  {Object.values(PrintMode).map((mode) => (
                    <option key={mode} value={mode}>
                      {PRINT_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Estación (opcional)</Label>
                <select
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  value={printerForm.stationId}
                  onChange={(event) => setPrinterForm((prev) => ({ ...prev, stationId: event.target.value }))}
                >
                  <option value="">Sin estación (impresora de recibos)</option>
                  {stations?.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={
                  !printerForm.name ||
                  (printerForm.connectionType === PrinterConnectionType.NETWORK ? !printerForm.ipAddress : !printerForm.usbPath) ||
                  createPrinter.isPending
                }
                onClick={() => createPrinter.mutate()}
              >
                Crear impresora
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatingPrinter(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={printers ?? []}
          isLoading={printersLoading}
          onRowClick={stationPanel.open}
          emptyMessage="No hay impresoras configuradas todavía."
        />
      </section>

      <SidePanel open={stationPanel.isOpen} onClose={stationPanel.close} title={stationPanel.selected?.name}>
        {stationPanel.selected && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Conexión</dt>
                <dd className="text-neutral-900">
                  {stationPanel.selected.connectionType === PrinterConnectionType.NETWORK
                    ? `${stationPanel.selected.ipAddress}:${stationPanel.selected.port}`
                    : stationPanel.selected.usbPath}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Estado</dt>
                <dd className="text-neutral-900">{STATUS_LABELS[stationPanel.selected.status]}</dd>
              </div>
            </dl>
            <Button size="sm" variant="destructive" disabled={removePrinter.isPending} onClick={() => removePrinter.mutate()}>
              Eliminar impresora
            </Button>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
