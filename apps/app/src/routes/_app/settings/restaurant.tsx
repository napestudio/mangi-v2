import { useEffect, useState } from "react";
import type { BusinessHoursShift } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

interface ShiftDraft {
  key: string;
  openTime: string;
  closeTime: string;
}

type ShiftsByDay = Record<number, ShiftDraft[]>;

function emptyShiftsByDay(): ShiftsByDay {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function defaultShiftsByDay(): ShiftsByDay {
  const result = emptyShiftsByDay();
  for (let day = 1; day <= 6; day++) {
    result[day] = [{ key: crypto.randomUUID(), openTime: "09:00", closeTime: "22:00" }];
  }
  return result;
}

function groupByDay(shifts: BusinessHoursShift[]): ShiftsByDay {
  const result = emptyShiftsByDay();
  for (const shift of shifts) {
    result[shift.dayOfWeek]!.push({ key: crypto.randomUUID(), openTime: shift.openTime, closeTime: shift.closeTime });
  }
  return result;
}

export const Route = createFileRoute("/_app/settings/restaurant")({
  component: RestaurantSettingsPage,
});

function RestaurantSettingsPage() {
  const queryClient = useQueryClient();
  const [shiftsByDay, setShiftsByDay] = useState<ShiftsByDay>(defaultShiftsByDay());

  const { data } = useQuery({
    queryKey: ["business-hours"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<BusinessHoursShift[]>>("/business-hours");
      return data.data;
    },
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    setShiftsByDay(groupByDay(data));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const shifts = Object.entries(shiftsByDay).flatMap(([dayOfWeek, dayShifts]) =>
        dayShifts.map((shift) => ({ dayOfWeek: Number(dayOfWeek), openTime: shift.openTime, closeTime: shift.closeTime })),
      );
      await apiClient.put("/business-hours", { shifts });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["business-hours"] });
      void queryClient.invalidateQueries({ queryKey: ["business-hours-status"] });
    },
  });

  function toggleDay(dayOfWeek: number, isOpen: boolean) {
    setShiftsByDay((prev) => ({
      ...prev,
      [dayOfWeek]: isOpen ? [{ key: crypto.randomUUID(), openTime: "09:00", closeTime: "22:00" }] : [],
    }));
  }

  function addShift(dayOfWeek: number) {
    setShiftsByDay((prev) => ({
      ...prev,
      [dayOfWeek]: [...prev[dayOfWeek]!, { key: crypto.randomUUID(), openTime: "16:00", closeTime: "23:00" }],
    }));
  }

  function removeShift(dayOfWeek: number, key: string) {
    setShiftsByDay((prev) => ({ ...prev, [dayOfWeek]: prev[dayOfWeek]!.filter((shift) => shift.key !== key) }));
  }

  function updateShift(dayOfWeek: number, key: string, patch: Partial<ShiftDraft>) {
    setShiftsByDay((prev) => ({
      ...prev,
      [dayOfWeek]: prev[dayOfWeek]!.map((shift) => (shift.key === key ? { ...shift, ...patch } : shift)),
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Restaurante</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Horario de atención</h2>
        <p className="text-xs text-neutral-500">
          Agregá más de un horario en un mismo día para turnos cortados (ej. almuerzo de 06:00 a 12:00 y cena de 16:00 a 23:00).
        </p>
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
          {DAY_LABELS.map((label, dayOfWeek) => {
            const dayShifts = shiftsByDay[dayOfWeek] ?? [];
            const isOpen = dayShifts.length > 0;
            return (
              <div key={dayOfWeek} className="flex flex-col gap-2 border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                    <input type="checkbox" checked={isOpen} onChange={(event) => toggleDay(dayOfWeek, event.target.checked)} />
                    {label}
                  </label>
                  {isOpen && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => addShift(dayOfWeek)}>
                      <Plus className="h-4 w-4" /> Horario
                    </Button>
                  )}
                </div>

                {isOpen ? (
                  <div className="flex flex-col gap-2 pl-6">
                    {dayShifts.map((shift) => (
                      <div key={shift.key} className="flex items-center gap-3">
                        <Input
                          type="time"
                          value={shift.openTime}
                          onChange={(event) => updateShift(dayOfWeek, shift.key, { openTime: event.target.value })}
                          className="w-32"
                        />
                        <span className="text-sm text-neutral-400">a</span>
                        <Input
                          type="time"
                          value={shift.closeTime}
                          onChange={(event) => updateShift(dayOfWeek, shift.key, { closeTime: event.target.value })}
                          className="w-32"
                        />
                        {dayShifts.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeShift(dayOfWeek, shift.key)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pl-6 text-sm text-neutral-400">Cerrado</p>
                )}
              </div>
            );
          })}
        </div>

        {save.isError && <p className="text-sm text-red-600">{extractErrorMessage(save.error, "No se pudo guardar el horario")}</p>}
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-fit">
          {save.isPending ? "Guardando..." : "Guardar horario"}
        </Button>
      </section>
    </div>
  );
}
