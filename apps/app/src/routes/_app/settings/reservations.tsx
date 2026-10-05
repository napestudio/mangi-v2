import { useEffect, useState } from "react";
import { Module } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface TimeSlotTableAssignment {
  tableId: string;
  exclusive: boolean;
  table: { id: string; number: string; sectorId: string };
}

interface TimeSlotItem {
  id: string;
  name: string | null;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  capacity: number;
  price: string | null;
  turnDurationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number;
  isActive: boolean;
  timeSlotTables: TimeSlotTableAssignment[];
}

interface TableOption {
  id: string;
  number: string;
  sectorId: string;
}

interface TimeSlotFormState {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  capacity: number;
  turnDurationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number;
}

function emptyForm(): TimeSlotFormState {
  return {
    name: "",
    startTime: "20:00",
    endTime: "23:00",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    capacity: 20,
    turnDurationMinutes: 90,
    bufferMinutes: 0,
    slotIntervalMinutes: 15,
  };
}

export const Route = createFileRoute("/_app/settings/reservations")({
  component: ReservationSettingsPage,
});

function ReservationSettingsPage() {
  const queryClient = useQueryClient();
  const { hasModule } = useModules();
  const panel = useSidePanel<TimeSlotItem>();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<TimeSlotFormState>(emptyForm());
  const [tableAssignments, setTableAssignments] = useState<Record<string, boolean>>({});

  const { data: timeSlots, isLoading } = useQuery({
    queryKey: ["time-slots"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TimeSlotItem[]>>("/time-slots");
      return data.data;
    },
  });

  const { data: tables } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TableOption[]>>("/tables");
      return data.data;
    },
    enabled: hasModule(Module.SALON),
  });

  useEffect(() => {
    if (!panel.selected) return;
    setForm({
      name: panel.selected.name ?? "",
      startTime: panel.selected.startTime,
      endTime: panel.selected.endTime,
      daysOfWeek: panel.selected.daysOfWeek,
      capacity: panel.selected.capacity,
      turnDurationMinutes: panel.selected.turnDurationMinutes,
      bufferMinutes: panel.selected.bufferMinutes,
      slotIntervalMinutes: panel.selected.slotIntervalMinutes,
    });
    setTableAssignments(Object.fromEntries(panel.selected.timeSlotTables.map((t) => [t.tableId, t.exclusive])));
  }, [panel.selected]);

  const createTimeSlot = useMutation({
    mutationFn: async () => {
      await apiClient.post("/time-slots", form);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["time-slots"] });
      setCreating(false);
      setForm(emptyForm());
    },
  });

  const updateTimeSlot = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.patch(`/time-slots/${panel.selected.id}`, form);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["time-slots"] });
    },
  });

  const deleteTimeSlot = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.delete(`/time-slots/${panel.selected.id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["time-slots"] });
      panel.close();
    },
  });

  const saveTableAssignments = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      const tables = Object.entries(tableAssignments)
        .filter(([, included]) => included !== undefined)
        .map(([tableId, exclusive]) => ({ tableId, exclusive: Boolean(exclusive) }));
      await apiClient.put(`/time-slots/${panel.selected.id}/tables`, { tables });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["time-slots"] });
    },
  });

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day) ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day].sort(),
    }));
  }

  const columns: ColumnDef<TimeSlotItem>[] = [
    { id: "name", header: "Nombre", cell: ({ row }) => row.original.name ?? "Sin nombre" },
    { id: "hours", header: "Horario", cell: ({ row }) => `${row.original.startTime} - ${row.original.endTime}` },
    {
      id: "days",
      header: "Días",
      cell: ({ row }) => row.original.daysOfWeek.map((d) => DAY_LABELS[d]).join(", "),
    },
    { accessorKey: "capacity", header: "Cupo" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Reservas</h1>
        {!creating && (
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm());
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> Turno
          </Button>
        )}
      </div>

      {creating && (
        <TimeSlotForm form={form} setForm={setForm} toggleDay={toggleDay}>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createTimeSlot.mutate()} disabled={createTimeSlot.isPending}>
              Crear turno
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </TimeSlotForm>
      )}

      <DataTable columns={columns} data={timeSlots ?? []} isLoading={isLoading} onRowClick={panel.open} emptyMessage="No hay turnos configurados." />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.name ?? "Turno"}>
        {panel.selected && (
          <div className="flex flex-col gap-6">
            <TimeSlotForm form={form} setForm={setForm} toggleDay={toggleDay}>
              <Button size="sm" onClick={() => updateTimeSlot.mutate()} disabled={updateTimeSlot.isPending}>
                Guardar cambios
              </Button>
            </TimeSlotForm>

            {hasModule(Module.SALON) && (
              <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
                <p className="text-xs font-medium uppercase text-neutral-500">Mesas asignadas (opcional)</p>
                <p className="text-xs text-neutral-500">
                  Marcá "exclusiva" para que esa mesa se bloquee para otras reservas mientras esté ocupada.
                </p>
                <div className="flex flex-col gap-1">
                  {tables?.map((table) => {
                    const included = tableAssignments[table.id] !== undefined;
                    const exclusive = tableAssignments[table.id] ?? false;
                    return (
                      <div key={table.id} className="flex items-center gap-3 text-sm">
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(event) =>
                              setTableAssignments((prev) => {
                                const next = { ...prev };
                                if (event.target.checked) next[table.id] = false;
                                else delete next[table.id];
                                return next;
                              })
                            }
                          />
                          Mesa {table.number}
                        </label>
                        <label className={cn("flex items-center gap-1.5 text-xs", !included && "opacity-40")}>
                          <input
                            type="checkbox"
                            disabled={!included}
                            checked={exclusive}
                            onChange={(event) => setTableAssignments((prev) => ({ ...prev, [table.id]: event.target.checked }))}
                          />
                          Exclusiva
                        </label>
                      </div>
                    );
                  })}
                  {tables && tables.length === 0 && <p className="text-sm text-neutral-500">No hay mesas cargadas en Salón.</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => saveTableAssignments.mutate()} disabled={saveTableAssignments.isPending}>
                  Guardar mesas
                </Button>
              </div>
            )}

            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteTimeSlot.mutate()}
              disabled={deleteTimeSlot.isPending}
              className="w-fit"
            >
              Eliminar turno
            </Button>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

function TimeSlotForm({
  form,
  setForm,
  toggleDay,
  children,
}: {
  form: TimeSlotFormState;
  setForm: React.Dispatch<React.SetStateAction<TimeSlotFormState>>;
  toggleDay: (day: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tsName">Nombre</Label>
        <Input id="tsName" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tsStart">Desde</Label>
          <Input id="tsStart" type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tsEnd">Hasta</Label>
          <Input id="tsEnd" type="time" value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Días</Label>
        <div className="flex flex-wrap gap-1">
          {DAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium",
                form.daysOfWeek.includes(day)
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-600",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tsCapacity">Cupo (comensales)</Label>
          <Input
            id="tsCapacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(event) => setForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tsDuration">Tiempo de mesa (min)</Label>
          <Input
            id="tsDuration"
            type="number"
            min={1}
            value={form.turnDurationMinutes}
            onChange={(event) => setForm((prev) => ({ ...prev, turnDurationMinutes: Number(event.target.value) }))}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tsBuffer">Buffer (min)</Label>
          <Input
            id="tsBuffer"
            type="number"
            min={0}
            value={form.bufferMinutes}
            onChange={(event) => setForm((prev) => ({ ...prev, bufferMinutes: Number(event.target.value) }))}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tsInterval">Bloques de reserva cada (min)</Label>
        <Input
          id="tsInterval"
          type="number"
          min={5}
          step={5}
          value={form.slotIntervalMinutes}
          onChange={(event) => setForm((prev) => ({ ...prev, slotIntervalMinutes: Number(event.target.value) }))}
        />
        <p className="text-xs text-neutral-500">
          Al cargar una reserva, solo se van a poder elegir horarios cada {form.slotIntervalMinutes} minutos dentro del turno.
        </p>
      </div>
      {children}
    </div>
  );
}
