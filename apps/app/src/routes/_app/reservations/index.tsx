import { useState } from "react";
import { Module, ReservationStatus } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ReservationItem {
  id: string;
  date: string;
  partySize: number;
  status: ReservationStatus;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  notes: string | null;
  timeSlot: { id: string; name: string | null };
  tables: { table: { id: string; number: string } }[];
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  [ReservationStatus.PENDING]: "Pendiente",
  [ReservationStatus.CONFIRMED]: "Confirmada",
  [ReservationStatus.SEATED]: "Sentada",
  [ReservationStatus.COMPLETED]: "Completada",
  [ReservationStatus.CANCELED]: "Cancelada",
  [ReservationStatus.NO_SHOW]: "No-show",
};

const STATUS_STYLES: Record<ReservationStatus, string> = {
  [ReservationStatus.PENDING]: "bg-amber-100 text-amber-800",
  [ReservationStatus.CONFIRMED]: "bg-sky-100 text-sky-800",
  [ReservationStatus.SEATED]: "bg-emerald-100 text-emerald-800",
  [ReservationStatus.COMPLETED]: "bg-neutral-200 text-neutral-700",
  [ReservationStatus.CANCELED]: "bg-red-100 text-red-700",
  [ReservationStatus.NO_SHOW]: "bg-red-100 text-red-700",
};

const NEXT_ACTIONS: Partial<Record<ReservationStatus, { label: string; to: ReservationStatus }[]>> = {
  [ReservationStatus.PENDING]: [
    { label: "Confirmar", to: ReservationStatus.CONFIRMED },
    { label: "Cancelar", to: ReservationStatus.CANCELED },
  ],
  [ReservationStatus.CONFIRMED]: [
    { label: "Sentar", to: ReservationStatus.SEATED },
    { label: "No-show", to: ReservationStatus.NO_SHOW },
    { label: "Cancelar", to: ReservationStatus.CANCELED },
  ],
  [ReservationStatus.SEATED]: [{ label: "Completar", to: ReservationStatus.COMPLETED }],
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const Route = createFileRoute("/_app/reservations/")({
  component: () => (
    <ModuleGuard module={Module.RESERVATIONS}>
      <ReservationsPage />
    </ModuleGuard>
  ),
});

function ReservationsPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<ReservationItem>();
  const [date, setDate] = useState(todayIso());
  const [view, setView] = useState<"day" | "upcoming">("day");

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", view, date],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ReservationItem[]>>("/reservations", {
        params: view === "day" ? { from: date, to: date } : { from: todayIso() },
      });
      return data.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReservationStatus }) => {
      await apiClient.patch(`/reservations/${id}/status`, { status });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations", view, date] });
      panel.close();
    },
  });

  const columns: ColumnDef<ReservationItem>[] = [
    ...(view === "upcoming"
      ? [
          {
            id: "date",
            header: "Fecha",
            cell: ({ row }: { row: { original: ReservationItem } }) =>
              new Date(row.original.date).toLocaleDateString("es-AR"),
          } satisfies ColumnDef<ReservationItem>,
        ]
      : []),
    { id: "time", header: "Hora", cell: ({ row }) => new Date(row.original.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) },
    { accessorKey: "guestName", header: "Cliente" },
    { accessorKey: "partySize", header: "Personas" },
    { id: "timeSlot", header: "Turno", cell: ({ row }) => row.original.timeSlot.name ?? "—" },
    {
      id: "tables",
      header: "Mesa",
      cell: ({ row }) => row.original.tables.map((t) => t.table.number).join(", ") || "—",
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
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Reservas</h1>
        <Link to="/reservations/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nueva reserva
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-neutral-300 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("day")}
            className={cn(
              "rounded px-3 py-1 text-sm font-medium",
              view === "day" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
            )}
          >
            Por día
          </button>
          <button
            type="button"
            onClick={() => setView("upcoming")}
            className={cn(
              "rounded px-3 py-1 text-sm font-medium",
              view === "upcoming" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
            )}
          >
            Próximas
          </button>
        </div>
        {view === "day" && (
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-48" />
        )}
      </div>

      <DataTable
        columns={columns}
        data={reservations ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage={view === "day" ? "No hay reservas para ese día." : "No hay reservas próximas."}
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.guestName}>
        {panel.selected && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Hora</p>
                <p className="text-neutral-900">{new Date(panel.selected.date).toLocaleString("es-AR")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Personas</p>
                <p className="text-neutral-900">{panel.selected.partySize}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Teléfono</p>
                <p className="text-neutral-900">{panel.selected.guestPhone ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Mesa</p>
                <p className="text-neutral-900">{panel.selected.tables.map((t) => t.table.number).join(", ") || "Sin asignar"}</p>
              </div>
            </div>

            {panel.selected.notes && (
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Notas</p>
                <p className="text-sm text-neutral-900">{panel.selected.notes}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Estado actual</p>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[panel.selected.status])}>
                {STATUS_LABELS[panel.selected.status]}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(NEXT_ACTIONS[panel.selected.status] ?? []).map((action) => (
                <Button
                  key={action.to}
                  size="sm"
                  variant={action.to === ReservationStatus.CANCELED || action.to === ReservationStatus.NO_SHOW ? "destructive" : "default"}
                  onClick={() => updateStatus.mutate({ id: panel.selected!.id, status: action.to })}
                  disabled={updateStatus.isPending}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
