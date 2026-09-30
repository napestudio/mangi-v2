import { useEffect, useMemo, useState } from "react";
import { generateTimeGrid, Module } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface TimeSlotOption {
  id: string;
  name: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
  slotIntervalMinutes: number;
  isActive: boolean;
  timeSlotTables: { tableId: string; exclusive: boolean; table: { number: string } }[];
}

interface AvailabilityResult {
  available: boolean;
  reason: "CAPACITY" | "TABLE_CONFLICT" | null;
  remainingCapacity: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const Route = createFileRoute("/_app/reservations/new")({
  component: NewReservationPage,
});

function NewReservationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasModule } = useModules();

  const [timeSlotId, setTimeSlotId] = useState("");
  const [businessDate, setBusinessDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [tableId, setTableId] = useState<string>("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");

  const { data: timeSlots } = useQuery({
    queryKey: ["time-slots"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TimeSlotOption[]>>("/time-slots");
      return data.data.filter((slot) => slot.isActive);
    },
  });

  const selectedTimeSlot = timeSlots?.find((slot) => slot.id === timeSlotId);

  const timeOptions = useMemo(
    () => (selectedTimeSlot ? generateTimeGrid(selectedTimeSlot.startTime, selectedTimeSlot.endTime, selectedTimeSlot.slotIntervalMinutes) : []),
    [selectedTimeSlot],
  );

  useEffect(() => {
    if (!selectedTimeSlot) {
      setTime("");
      return;
    }
    if (!timeOptions.includes(time)) {
      setTime(timeOptions[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeSlot?.id]);

  const { data: availability, isFetching: isCheckingAvailability } = useQuery({
    queryKey: ["reservation-availability", timeSlotId, businessDate, time, partySize, tableId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<AvailabilityResult>>("/reservations/availability", {
        params: { timeSlotId, businessDate, time, partySize, tableIds: tableId || undefined },
      });
      return data.data;
    },
    enabled: !!timeSlotId && !!businessDate && !!time && partySize > 0,
  });

  const createReservation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiEnvelope<{ id: string }>>("/reservations", {
        timeSlotId,
        businessDate,
        time,
        partySize,
        guestName,
        guestPhone: guestPhone || undefined,
        guestEmail: guestEmail || undefined,
        notes: notes || undefined,
        tableIds: tableId ? [tableId] : undefined,
      });
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void navigate({ to: "/reservations" });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Nueva reserva</h1>
      <Card>
        <CardHeader>
          <CardTitle>Detalle de la reserva</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createReservation.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timeSlot">Turno</Label>
              <select
                id="timeSlot"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                value={timeSlotId}
                onChange={(event) => {
                  setTimeSlotId(event.target.value);
                  setTableId("");
                }}
                required
              >
                <option value="">Seleccioná un turno</option>
                {timeSlots?.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name ?? `${slot.startTime}-${slot.endTime}`} ({slot.startTime}-{slot.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="date">Fecha</Label>
                <Input id="date" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} required />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="time">Hora</Label>
                <select
                  id="time"
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  disabled={!selectedTimeSlot}
                  required
                >
                  {!selectedTimeSlot && <option value="">Elegí un turno primero</option>}
                  {timeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="partySize">Personas</Label>
                <Input
                  id="partySize"
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(event) => setPartySize(Number(event.target.value))}
                  required
                />
              </div>
            </div>

            {hasModule(Module.SALON) && selectedTimeSlot && selectedTimeSlot.timeSlotTables.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="table">Mesa (opcional)</Label>
                <select
                  id="table"
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  value={tableId}
                  onChange={(event) => setTableId(event.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {selectedTimeSlot.timeSlotTables.map((t) => (
                    <option key={t.tableId} value={t.tableId}>
                      Mesa {t.table.number}
                      {t.exclusive ? " (exclusiva)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {timeSlotId && time && !isCheckingAvailability && availability && (
              <p
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  availability.available ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700",
                )}
              >
                {availability.available
                  ? `Hay lugar (quedan ${availability.remainingCapacity} lugares en el turno).`
                  : availability.reason === "CAPACITY"
                    ? "No hay cupo disponible en ese turno."
                    : "Esa mesa no está disponible en ese horario."}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guestName">Nombre del cliente</Label>
              <Input id="guestName" value={guestName} onChange={(event) => setGuestName(event.target.value)} required />
            </div>

            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="guestPhone">Teléfono</Label>
                <Input id="guestPhone" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="guestEmail">Email</Label>
                <Input id="guestEmail" type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            {createReservation.isError && <p className="text-sm text-red-600">No se pudo crear la reserva</p>}
            <Button type="submit" disabled={createReservation.isPending || (availability ? !availability.available : false)}>
              {createReservation.isPending ? "Creando..." : "Crear reserva"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
