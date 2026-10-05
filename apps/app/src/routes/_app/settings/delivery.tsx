import { useEffect, useState } from "react";
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

interface RestaurantLocation {
  id: string;
  latitude: number | null;
  longitude: number | null;
}

interface DeliveryConfigData {
  id: string;
  isEnabled: boolean;
  minOrderAmount: string | null;
  deliveryFee: string;
  estimatedMinutes: number | null;
  notes: string | null;
}

interface DeliveryZoneItem {
  id: string;
  name: string;
  type: "RADIUS" | "POLYGON";
  minRadiusMeters: number | null;
  maxRadiusMeters: number | null;
  fee: string;
  estimatedMinutes: number | null;
  priority: number;
  isActive: boolean;
}

interface ZoneFormState {
  name: string;
  minKm: string;
  maxKm: string;
  fee: string;
  estimatedMinutes: string;
  priority: string;
  isActive: boolean;
}

function emptyZoneForm(): ZoneFormState {
  return { name: "", minKm: "0", maxKm: "", fee: "", estimatedMinutes: "", priority: "0", isActive: true };
}

function zoneToForm(zone: DeliveryZoneItem): ZoneFormState {
  return {
    name: zone.name,
    minKm: zone.minRadiusMeters != null ? String(zone.minRadiusMeters / 1000) : "0",
    maxKm: zone.maxRadiusMeters != null ? String(zone.maxRadiusMeters / 1000) : "",
    fee: zone.fee,
    estimatedMinutes: zone.estimatedMinutes != null ? String(zone.estimatedMinutes) : "",
    priority: String(zone.priority),
    isActive: zone.isActive,
  };
}

export const Route = createFileRoute("/_app/settings/delivery")({
  component: DeliverySettingsPage,
});

const columns: ColumnDef<DeliveryZoneItem>[] = [
  { accessorKey: "name", header: "Zona" },
  {
    id: "range",
    header: "Rango",
    cell: ({ row }) => {
      const min = row.original.minRadiusMeters != null ? row.original.minRadiusMeters / 1000 : 0;
      const max = row.original.maxRadiusMeters != null ? `${row.original.maxRadiusMeters / 1000}km` : "sin límite";
      return `${min}km – ${max}`;
    },
  },
  { id: "fee", header: "Costo", cell: ({ row }) => `$${row.original.fee}` },
  { id: "priority", header: "Prioridad", cell: ({ row }) => row.original.priority },
  {
    id: "status",
    header: "Estado",
    cell: ({ row }) => (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          row.original.isActive ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600",
        )}
      >
        {row.original.isActive ? "Activa" : "Inactiva"}
      </span>
    ),
  },
];

function DeliverySettingsPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<DeliveryZoneItem>();

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [configForm, setConfigForm] = useState({ isEnabled: false, minOrderAmount: "", deliveryFee: "0", estimatedMinutes: "", notes: "" });

  const [creatingZone, setCreatingZone] = useState(false);
  const [newZoneForm, setNewZoneForm] = useState<ZoneFormState>(emptyZoneForm());
  const [editZoneForm, setEditZoneForm] = useState<ZoneFormState | null>(null);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-me"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<RestaurantLocation>>("/restaurants/me");
      return data.data;
    },
  });

  const { data: deliveryConfig } = useQuery({
    queryKey: ["delivery-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<DeliveryConfigData>>("/delivery-config");
      return data.data;
    },
  });

  const { data: zones, isLoading: zonesLoading } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<DeliveryZoneItem[]>>("/delivery-zones");
      return data.data;
    },
  });

  useEffect(() => {
    if (!restaurant) return;
    setLatitude(restaurant.latitude != null ? String(restaurant.latitude) : "");
    setLongitude(restaurant.longitude != null ? String(restaurant.longitude) : "");
  }, [restaurant]);

  useEffect(() => {
    if (!deliveryConfig) return;
    setConfigForm({
      isEnabled: deliveryConfig.isEnabled,
      minOrderAmount: deliveryConfig.minOrderAmount ?? "",
      deliveryFee: deliveryConfig.deliveryFee,
      estimatedMinutes: deliveryConfig.estimatedMinutes != null ? String(deliveryConfig.estimatedMinutes) : "",
      notes: deliveryConfig.notes ?? "",
    });
  }, [deliveryConfig]);

  useEffect(() => {
    setEditZoneForm(panel.selected ? zoneToForm(panel.selected) : null);
  }, [panel.selected]);

  const saveLocation = useMutation({
    mutationFn: async () => {
      await apiClient.patch("/restaurants/me", {
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["restaurant-me"] }),
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      await apiClient.put("/delivery-config", {
        isEnabled: configForm.isEnabled,
        minOrderAmount: configForm.minOrderAmount ? Number(configForm.minOrderAmount) : undefined,
        deliveryFee: Number(configForm.deliveryFee || 0),
        estimatedMinutes: configForm.estimatedMinutes ? Number(configForm.estimatedMinutes) : undefined,
        notes: configForm.notes || undefined,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["delivery-config"] }),
  });

  function zonePayload(form: ZoneFormState) {
    return {
      name: form.name,
      minRadiusMeters: form.minKm ? Number(form.minKm) * 1000 : 0,
      maxRadiusMeters: form.maxKm ? Number(form.maxKm) * 1000 : undefined,
      fee: Number(form.fee || 0),
      estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
      priority: Number(form.priority || 0),
      isActive: form.isActive,
    };
  }

  const createZone = useMutation({
    mutationFn: async () => {
      await apiClient.post("/delivery-zones", zonePayload(newZoneForm));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      setCreatingZone(false);
      setNewZoneForm(emptyZoneForm());
    },
  });

  const updateZone = useMutation({
    mutationFn: async () => {
      if (!panel.selected || !editZoneForm) return;
      await apiClient.patch(`/delivery-zones/${panel.selected.id}`, zonePayload(editZoneForm));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      panel.close();
    },
  });

  const deleteZone = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.delete(`/delivery-zones/${panel.selected.id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      panel.close();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Delivery</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Ubicación del restaurante</h2>
        <p className="text-sm text-neutral-500">
          Punto de referencia desde el cual se calculan los anillos de distancia de cada zona. Copiá las coordenadas desde Google Maps.
        </p>
        <div className="flex items-end gap-2 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="latitude">Latitud</Label>
            <Input id="latitude" type="number" step="any" className="w-40" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="longitude">Longitud</Label>
            <Input id="longitude" type="number" step="any" className="w-40" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </div>
          <Button size="sm" disabled={saveLocation.isPending} onClick={() => saveLocation.mutate()}>
            Guardar
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Configuración general</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={configForm.isEnabled}
              onChange={(event) => setConfigForm((prev) => ({ ...prev, isEnabled: event.target.checked }))}
            />
            Delivery habilitado
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minOrderAmount">Pedido mínimo</Label>
              <Input
                id="minOrderAmount"
                type="number"
                min={0}
                value={configForm.minOrderAmount}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, minOrderAmount: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deliveryFeeFallback">Costo de envío por defecto</Label>
              <Input
                id="deliveryFeeFallback"
                type="number"
                min={0}
                value={configForm.deliveryFee}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, deliveryFee: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="estimatedMinutes">Tiempo estimado (min)</Label>
              <Input
                id="estimatedMinutes"
                type="number"
                min={0}
                value={configForm.estimatedMinutes}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, estimatedMinutes: event.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            El costo por defecto se usa cuando un pedido de delivery no tiene una zona asignada.
          </p>
          <Button size="sm" className="w-fit" disabled={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
            Guardar configuración
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Zonas de entrega</h2>
          {!creatingZone && (
            <Button
              size="sm"
              onClick={() => {
                setNewZoneForm(emptyZoneForm());
                setCreatingZone(true);
              }}
            >
              <Plus className="h-4 w-4" /> Zona
            </Button>
          )}
        </div>

        {creatingZone && (
          <ZoneForm
            form={newZoneForm}
            onChange={setNewZoneForm}
            onSubmit={() => createZone.mutate()}
            onCancel={() => setCreatingZone(false)}
            submitting={createZone.isPending}
            submitLabel="Crear zona"
          />
        )}

        <DataTable
          columns={columns}
          data={zones ?? []}
          isLoading={zonesLoading}
          onRowClick={panel.open}
          emptyMessage="No hay zonas de entrega configuradas todavía."
        />
      </section>

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.name}>
        {editZoneForm && (
          <div className="flex flex-col gap-4">
            <ZoneForm
              form={editZoneForm}
              onChange={(updater) => setEditZoneForm((prev) => (prev ? updater(prev) : prev))}
              onSubmit={() => updateZone.mutate()}
              submitting={updateZone.isPending}
              submitLabel="Guardar cambios"
            />
            <Button size="sm" variant="destructive" disabled={deleteZone.isPending} onClick={() => deleteZone.mutate()}>
              Eliminar zona
            </Button>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

function ZoneForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: {
  form: ZoneFormState;
  onChange: (updater: (prev: ZoneFormState) => ZoneFormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Costo de envío</Label>
          <Input type="number" min={0} value={form.fee} onChange={(event) => onChange((prev) => ({ ...prev, fee: event.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Desde (km)</Label>
          <Input type="number" min={0} step="0.1" value={form.minKm} onChange={(event) => onChange((prev) => ({ ...prev, minKm: event.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Hasta (km)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            placeholder="Sin límite"
            value={form.maxKm}
            onChange={(event) => onChange((prev) => ({ ...prev, maxKm: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Tiempo estimado (min)</Label>
          <Input
            type="number"
            min={0}
            value={form.estimatedMinutes}
            onChange={(event) => onChange((prev) => ({ ...prev, estimatedMinutes: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Prioridad</Label>
          <Input type="number" value={form.priority} onChange={(event) => onChange((prev) => ({ ...prev, priority: event.target.value }))} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={form.isActive} onChange={(event) => onChange((prev) => ({ ...prev, isActive: event.target.checked }))} />
        Zona activa
      </label>

      <div className="flex gap-2">
        <Button size="sm" disabled={!form.name || !form.fee || submitting} onClick={onSubmit}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
