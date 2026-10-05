import { useEffect, useState } from "react";
import type { BusinessHoursRow } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function defaultRows(): BusinessHoursRow[] {
  return DAY_LABELS.map((_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 0,
    openTime: "09:00",
    closeTime: "22:00",
  }));
}

export const Route = createFileRoute("/_app/settings/restaurant")({
  component: RestaurantSettingsPage,
});

function RestaurantSettingsPage() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BusinessHoursRow[]>(defaultRows());

  const { data } = useQuery({
    queryKey: ["business-hours"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<BusinessHoursRow[]>>("/business-hours");
      return data.data;
    },
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    setRows((prev) => prev.map((row) => data.find((saved) => saved.dayOfWeek === row.dayOfWeek) ?? row));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await apiClient.put("/business-hours", { rows });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["business-hours"] });
      void queryClient.invalidateQueries({ queryKey: ["business-hours-status"] });
    },
  });

  function updateRow(dayOfWeek: number, patch: Partial<BusinessHoursRow>) {
    setRows((prev) => prev.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Restaurante</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Horario de atención</h2>
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
          {rows.map((row) => (
            <div key={row.dayOfWeek} className="flex items-center gap-3 border-b border-neutral-100 py-2 last:border-0">
              <label className="flex w-40 items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={row.isOpen}
                  onChange={(event) => updateRow(row.dayOfWeek, { isOpen: event.target.checked })}
                />
                {DAY_LABELS[row.dayOfWeek]}
              </label>
              <Input
                type="time"
                value={row.openTime}
                disabled={!row.isOpen}
                onChange={(event) => updateRow(row.dayOfWeek, { openTime: event.target.value })}
                className="w-32"
              />
              <span className="text-sm text-neutral-400">a</span>
              <Input
                type="time"
                value={row.closeTime}
                disabled={!row.isOpen}
                onChange={(event) => updateRow(row.dayOfWeek, { closeTime: event.target.value })}
                className="w-32"
              />
            </div>
          ))}
        </div>

        {save.isError && <p className="text-sm text-red-600">No se pudo guardar el horario</p>}
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-fit">
          {save.isPending ? "Guardando..." : "Guardar horario"}
        </Button>
      </section>
    </div>
  );
}
