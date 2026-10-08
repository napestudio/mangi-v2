import { useState, type Dispatch, type SetStateAction } from "react";
import { getCharsPerLine, PAPER_WIDTH_OPTIONS, PrinterConnectionType, PrintJobStatus, PrintMode } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { isAxiosError } from "axios";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast";
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
  paperWidth: number;
  printMode: PrintMode;
  headerText: string | null;
  footerText: string | null;
  copies: number;
  status: "ONLINE" | "OFFLINE" | "ERROR";
  isActive: boolean;
  stationId: string | null;
}

interface PrintJobItem {
  id: string;
  status: PrintJobStatus;
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

function stationFormFromItem(station: StationItem): StationFormState {
  return {
    name: station.name,
    color: station.color ?? "",
    categoryIds: station.categories.map((entry) => entry.category.id),
  };
}

interface PrinterFormState {
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress: string;
  port: string;
  usbPath: string;
  paperWidth: number;
  printMode: PrintMode;
  stationId: string;
  copies: string;
  headerText: string;
  footerText: string;
}

function emptyPrinterForm(): PrinterFormState {
  return {
    name: "",
    connectionType: PrinterConnectionType.NETWORK,
    ipAddress: "",
    port: "9100",
    usbPath: "",
    paperWidth: 80,
    printMode: PrintMode.FULL_ORDER,
    stationId: "",
    copies: "1",
    headerText: "",
    footerText: "",
  };
}

function printerFormFromItem(printer: PrinterItem): PrinterFormState {
  return {
    name: printer.name,
    connectionType: printer.connectionType,
    ipAddress: printer.ipAddress ?? "",
    port: String(printer.port ?? 9100),
    usbPath: printer.usbPath ?? "",
    paperWidth: printer.paperWidth,
    printMode: printer.printMode,
    stationId: printer.stationId ?? "",
    copies: String(printer.copies ?? 1),
    headerText: printer.headerText ?? "",
    footerText: printer.footerText ?? "",
  };
}

function printerFormIsValid(form: PrinterFormState): boolean {
  return Boolean(form.name) && (form.connectionType === PrinterConnectionType.NETWORK ? Boolean(form.ipAddress) : Boolean(form.usbPath));
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

/** Sondea el print job de prueba hasta que el callback del proceso main de Electron lo confirme o
 * falle (ver mangiar-printing SKILL.md) — no hay evento de socket para esto, así que se pollea
 * GET /print-jobs/printer/:id, que ya existía para otro uso. */
async function pollTestPrintJob(printerId: string, jobId: string): Promise<"success" | "error"> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const { data } = await apiClient.get<ApiEnvelope<PrintJobItem[]>>(`/print-jobs/printer/${printerId}`);
    const job = data.data.find((item) => item.id === jobId);
    if (job?.status === PrintJobStatus.CONFIRMED) return "success";
    if (job?.status === PrintJobStatus.FAILED || job?.status === PrintJobStatus.CANCELED) return "error";
  }
  return "error";
}

export const Route = createFileRoute("/_app/settings/printing")({
  component: PrintingSettingsPage,
});

interface PrinterFormFieldsProps {
  form: PrinterFormState;
  setForm: Dispatch<SetStateAction<PrinterFormState>>;
  stations: StationItem[] | undefined;
  showAdvanced: boolean;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
}

/** Campos compartidos entre el alta (form inline arriba de la tabla) y la edición (dentro del
 * SidePanel) — mismo patrón que ProductForm en menu/products/index.tsx. */
function PrinterFormFields({ form, setForm, stations, showAdvanced, setShowAdvanced }: PrinterFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1.5">
        <Label>Nombre</Label>
        <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Tipo de conexión</Label>
        <select
          className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          value={form.connectionType}
          onChange={(event) => setForm((prev) => ({ ...prev, connectionType: event.target.value as PrinterConnectionType }))}
        >
          <option value={PrinterConnectionType.NETWORK}>Red (Ethernet o WiFi)</option>
          <option value={PrinterConnectionType.USB}>USB</option>
        </select>
      </div>

      {form.connectionType === PrinterConnectionType.NETWORK ? (
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>Dirección IP</Label>
          <Input
            placeholder="192.168.0.50"
            value={form.ipAddress}
            onChange={(event) => setForm((prev) => ({ ...prev, ipAddress: event.target.value }))}
          />
        </div>
      ) : (
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>Nombre de la impresora en el sistema</Label>
          <Input
            placeholder="EPSON TM-T20III"
            value={form.usbPath}
            onChange={(event) => setForm((prev) => ({ ...prev, usbPath: event.target.value }))}
          />
          <p className="text-xs text-neutral-500">Tal como aparece en las impresoras instaladas de Windows/macOS.</p>
        </div>
      )}

      <div className="col-span-2 flex flex-col gap-2 border-t border-neutral-200 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Configuración de impresión</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>Ancho del papel</Label>
            <select
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
              value={form.paperWidth}
              onChange={(event) => setForm((prev) => ({ ...prev, paperWidth: Number(event.target.value) }))}
            >
              {PAPER_WIDTH_OPTIONS.map((width) => (
                <option key={width} value={width}>
                  {width}mm
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Caracteres por línea</Label>
            <div className="flex h-10 w-full items-center rounded-md border border-neutral-200 bg-neutral-100 px-3 text-sm text-neutral-500">
              {getCharsPerLine(form.paperWidth)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Qué imprime</Label>
        <select
          className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          value={form.printMode}
          onChange={(event) => setForm((prev) => ({ ...prev, printMode: event.target.value as PrintMode }))}
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
          value={form.stationId}
          onChange={(event) => setForm((prev) => ({ ...prev, stationId: event.target.value }))}
        >
          <option value="">Sin estación (impresora de recibos)</option>
          {stations?.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
        >
          {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Configuración avanzada
        </button>
      </div>

      {showAdvanced && (
        <div className="col-span-2 grid grid-cols-2 gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          {form.connectionType === PrinterConnectionType.NETWORK && (
            <div className="flex flex-col gap-1.5">
              <Label>Puerto</Label>
              <Input
                type="number"
                value={form.port}
                onChange={(event) => setForm((prev) => ({ ...prev, port: event.target.value }))}
              />
              <p className="text-xs text-neutral-500">El puerto estándar de impresoras de red es 9100.</p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Número de copias</Label>
            <Input
              type="number"
              min={1}
              value={form.copies}
              onChange={(event) => setForm((prev) => ({ ...prev, copies: event.target.value }))}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Texto de encabezado (opcional)</Label>
            <Input
              value={form.headerText}
              onChange={(event) => setForm((prev) => ({ ...prev, headerText: event.target.value }))}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Texto de pie (opcional)</Label>
            <Input
              value={form.footerText}
              onChange={(event) => setForm((prev) => ({ ...prev, footerText: event.target.value }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface StationCategoryPickerProps {
  form: StationFormState;
  setForm: Dispatch<SetStateAction<StationFormState>>;
  categories: CategoryOption[] | undefined;
}

/** Compartido entre el alta y la edición de una estación. */
function StationCategoryPicker({ form, setForm, categories }: StationCategoryPickerProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-xs text-neutral-500">Categorías que imprime esta estación</p>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <label key={category.id} className="flex items-center gap-1.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.categoryIds.includes(category.id)}
              onChange={(event) =>
                setForm((prev) => ({
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
  );
}

function PrintingSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const printerPanel = useSidePanel<string>();

  const [creatingStation, setCreatingStation] = useState(false);
  const [stationForm, setStationForm] = useState<StationFormState>(emptyStationForm());
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [confirmingStationId, setConfirmingStationId] = useState<string | null>(null);

  const [creatingPrinter, setCreatingPrinter] = useState(false);
  const [printerForm, setPrinterForm] = useState<PrinterFormState>(emptyPrinterForm());
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [printerPanelMode, setPrinterPanelMode] = useState<"info" | "edit">("info");
  const [confirmingPrinterDelete, setConfirmingPrinterDelete] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "pending" | "success" | "error">("idle");

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

  const selectedPrinter = printers?.find((printer) => printer.id === printerPanel.selected) ?? null;

  function openPrinterPanel(printer: PrinterItem) {
    setPrinterPanelMode("info");
    setConfirmingPrinterDelete(false);
    setTestStatus("idle");
    printerPanel.open(printer.id);
  }

  function closePrinterPanel() {
    printerPanel.close();
    setPrinterPanelMode("info");
    setConfirmingPrinterDelete(false);
    setTestStatus("idle");
  }

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

  const updateStation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/stations/${id}`, stationForm);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stations"] });
      setEditingStationId(null);
    },
  });

  const removeStation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/stations/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stations"] });
      setConfirmingStationId(null);
    },
  });

  const createPrinter = useMutation({
    mutationFn: async () => {
      await apiClient.post("/printers", {
        name: printerForm.name,
        connectionType: printerForm.connectionType,
        ipAddress: printerForm.connectionType === PrinterConnectionType.NETWORK ? printerForm.ipAddress : undefined,
        port: printerForm.connectionType === PrinterConnectionType.NETWORK ? Number(printerForm.port || 9100) : undefined,
        usbPath: printerForm.connectionType === PrinterConnectionType.USB ? printerForm.usbPath : undefined,
        paperWidth: printerForm.paperWidth,
        printMode: printerForm.printMode,
        stationId: printerForm.stationId || undefined,
        copies: Number(printerForm.copies || 1),
        headerText: printerForm.headerText.trim() || undefined,
        footerText: printerForm.footerText.trim() || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      setCreatingPrinter(false);
      setShowAdvanced(false);
      setPrinterForm(emptyPrinterForm());
    },
  });

  const updatePrinter = useMutation({
    mutationFn: async () => {
      if (!printerPanel.selected) return;
      await apiClient.patch(`/printers/${printerPanel.selected}`, {
        name: printerForm.name,
        connectionType: printerForm.connectionType,
        ipAddress: printerForm.connectionType === PrinterConnectionType.NETWORK ? printerForm.ipAddress : undefined,
        port: printerForm.connectionType === PrinterConnectionType.NETWORK ? Number(printerForm.port || 9100) : undefined,
        usbPath: printerForm.connectionType === PrinterConnectionType.USB ? printerForm.usbPath : undefined,
        paperWidth: printerForm.paperWidth,
        printMode: printerForm.printMode,
        // "" (en vez de `|| undefined`) manda la intención de desasignar la estación — ver el
        // comentario en PrintersService.update().
        stationId: printerForm.stationId,
        copies: Number(printerForm.copies || 1),
        headerText: printerForm.headerText.trim(),
        footerText: printerForm.footerText.trim(),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      setPrinterPanelMode("info");
    },
  });

  const removePrinter = useMutation({
    mutationFn: async () => {
      if (!printerPanel.selected) return;
      await apiClient.delete(`/printers/${printerPanel.selected}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      closePrinterPanel();
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (printer: PrinterItem) => {
      await apiClient.patch(`/printers/${printer.id}`, { isActive: !printer.isActive });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (error) => {
      toast.show({ message: extractErrorMessage(error, "No se pudo actualizar la impresora."), variant: "error" });
    },
  });

  const testPrint = useMutation({
    mutationFn: async (printerId: string) => {
      const { data } = await apiClient.post<ApiEnvelope<PrintJobItem>>(`/printers/${printerId}/test-print`);
      return { printerId, jobId: data.data.id };
    },
    onSuccess: async ({ printerId, jobId }) => {
      setTestStatus("pending");
      const result = await pollTestPrintJob(printerId, jobId);
      setTestStatus(result);
      toast.show({
        message:
          result === "success"
            ? "La impresora confirmó la prueba de impresión."
            : "La impresora no confirmó la prueba de impresión. Revisá la conexión.",
        variant: result === "success" ? "success" : "error",
      });
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (error) => {
      setTestStatus("idle");
      toast.show({ message: extractErrorMessage(error, "No se pudo enviar la prueba de impresión."), variant: "error" });
    },
  });

  const columns: ColumnDef<PrinterItem>[] = [
    { accessorKey: "name", header: "Nombre" },
    {
      id: "connection",
      header: "Conexión",
      cell: ({ row }) =>
        row.original.connectionType === PrinterConnectionType.NETWORK
          ? `Red · ${row.original.ipAddress}:${row.original.port ?? 9100}`
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
          {!creatingStation && !editingStationId && (
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
            {createStation.isError && (
              <p className="text-xs text-red-600">{extractErrorMessage(createStation.error, "No se pudo crear la estación.")}</p>
            )}
            <StationCategoryPicker form={stationForm} setForm={setStationForm} categories={categories} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {stationsLoading && <p className="text-sm text-neutral-500">Cargando...</p>}
          {!stationsLoading && stations?.length === 0 && <p className="text-sm text-neutral-500">No hay estaciones configuradas.</p>}
          {stations?.map((station) => (
            <div key={station.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              {confirmingStationId === station.id ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-neutral-600">¿Eliminar la estación "{station.name}"? Esta acción no se puede deshacer.</p>
                  {removeStation.isError && (
                    <p className="text-xs text-red-600">{extractErrorMessage(removeStation.error, "No se pudo eliminar la estación.")}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setConfirmingStationId(null);
                        removeStation.reset();
                      }}
                    >
                      No
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={removeStation.isPending}
                      onClick={() => removeStation.mutate(station.id)}
                    >
                      Sí, eliminar
                    </Button>
                  </div>
                </div>
              ) : editingStationId === station.id ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`stationName-${station.id}`}>Nombre</Label>
                    <Input
                      id={`stationName-${station.id}`}
                      autoFocus
                      value={stationForm.name}
                      onChange={(event) => setStationForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="h-9 w-48"
                    />
                  </div>
                  <StationCategoryPicker form={stationForm} setForm={setStationForm} categories={categories} />
                  {updateStation.isError && (
                    <p className="text-xs text-red-600">{extractErrorMessage(updateStation.error, "No se pudo actualizar la estación.")}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!stationForm.name.trim() || updateStation.isPending}
                      onClick={() => updateStation.mutate(station.id)}
                    >
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingStationId(null);
                        updateStation.reset();
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{station.name}</p>
                    <p className="text-xs text-neutral-500">
                      {station.categories.map((entry) => entry.category.name).join(", ") || "Sin categorías asignadas"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setStationForm(stationFormFromItem(station));
                        setCreatingStation(false);
                        setEditingStationId(station.id);
                      }}
                    >
                      Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setConfirmingStationId(station.id)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              )}
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
                setShowAdvanced(false);
                setCreatingPrinter(true);
              }}
            >
              <Plus className="h-4 w-4" /> Impresora
            </Button>
          )}
        </div>

        {creatingPrinter && (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <PrinterFormFields
              form={printerForm}
              setForm={setPrinterForm}
              stations={stations}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
            />

            {createPrinter.isError && (
              <p className="text-xs text-red-600">{extractErrorMessage(createPrinter.error, "No se pudo crear la impresora.")}</p>
            )}

            <div className="flex gap-2">
              <Button size="sm" disabled={!printerFormIsValid(printerForm) || createPrinter.isPending} onClick={() => createPrinter.mutate()}>
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
          onRowClick={openPrinterPanel}
          emptyMessage="No hay impresoras configuradas todavía."
        />
      </section>

      <SidePanel open={printerPanel.isOpen} onClose={closePrinterPanel} title={selectedPrinter?.name}>
        {selectedPrinter && printerPanelMode === "info" && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-neutral-500">Conexión</dt>
                <dd className="text-neutral-900">
                  {selectedPrinter.connectionType === PrinterConnectionType.NETWORK
                    ? `Red · ${selectedPrinter.ipAddress}:${selectedPrinter.port ?? 9100}`
                    : `USB · ${selectedPrinter.usbPath}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Estado</dt>
                <dd>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[selectedPrinter.status])}>
                    {STATUS_LABELS[selectedPrinter.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Activa</dt>
                <dd className="text-neutral-900">{selectedPrinter.isActive ? "Sí" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Papel</dt>
                <dd className="text-neutral-900">
                  {selectedPrinter.paperWidth}mm · {getCharsPerLine(selectedPrinter.paperWidth)} car./línea
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Imprime</dt>
                <dd className="text-neutral-900">{PRINT_MODE_LABELS[selectedPrinter.printMode]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Estación</dt>
                <dd className="text-neutral-900">
                  {stations?.find((station) => station.id === selectedPrinter.stationId)?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Copias</dt>
                <dd className="text-neutral-900">{selectedPrinter.copies}</dd>
              </div>
              {selectedPrinter.headerText && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium uppercase text-neutral-500">Encabezado</dt>
                  <dd className="text-neutral-900">{selectedPrinter.headerText}</dd>
                </div>
              )}
              {selectedPrinter.footerText && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium uppercase text-neutral-500">Pie</dt>
                  <dd className="text-neutral-900">{selectedPrinter.footerText}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setPrinterForm(printerFormFromItem(selectedPrinter));
                    setShowAdvanced(false);
                    setPrinterPanelMode("edit");
                  }}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={toggleActive.isPending}
                  onClick={() => toggleActive.mutate(selectedPrinter)}
                >
                  {selectedPrinter.isActive ? "Desactivar" : "Activar"}
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                disabled={testPrint.isPending || testStatus === "pending"}
                onClick={() => testPrint.mutate(selectedPrinter.id)}
              >
                {testPrint.isPending || testStatus === "pending" ? "Imprimiendo..." : "Prueba de impresión"}
              </Button>

              {confirmingPrinterDelete ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-neutral-600">¿Eliminar esta impresora? Esta acción no se puede deshacer.</p>
                  {removePrinter.isError && (
                    <p className="text-xs text-red-600">{extractErrorMessage(removePrinter.error, "No se pudo eliminar la impresora.")}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setConfirmingPrinterDelete(false);
                        removePrinter.reset();
                      }}
                    >
                      No
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={removePrinter.isPending}
                      onClick={() => removePrinter.mutate()}
                    >
                      Sí, eliminar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setConfirmingPrinterDelete(true)}>
                  Eliminar impresora
                </Button>
              )}
            </div>
          </div>
        )}

        {selectedPrinter && printerPanelMode === "edit" && (
          <div className="flex flex-col gap-3">
            <PrinterFormFields
              form={printerForm}
              setForm={setPrinterForm}
              stations={stations}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
            />

            {updatePrinter.isError && (
              <p className="text-xs text-red-600">{extractErrorMessage(updatePrinter.error, "No se pudo actualizar la impresora.")}</p>
            )}

            <div className="flex gap-2 border-t border-neutral-200 pt-3">
              <Button
                size="sm"
                className="flex-1"
                disabled={!printerFormIsValid(printerForm) || updatePrinter.isPending}
                onClick={() => updatePrinter.mutate()}
              >
                Guardar cambios
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPrinterPanelMode("info")}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
