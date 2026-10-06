import { useState, type FormEvent } from "react";
import { TableStatus } from "@mangiar/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/useAuth";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import type { FloorPlanTable } from "../salon/FloorPlanCanvas";
import { patchTableStatus } from "./tableCache";
import type { OrderView } from "./types";

interface OpenTableFormProps {
  table: FloorPlanTable;
  onCreated?: (order: OrderView) => void;
}

export function OpenTableForm({ table, onCreated }: OpenTableFormProps) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [guestCount, setGuestCount] = useState("2");
  const [assignedToId, setAssignedToId] = useState(user?.id ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const openTable = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiEnvelope<OrderView>>("/orders", {
        type: "DINE_IN",
        tableId: table.id,
        assignedToId: assignedToId || undefined,
        guestCount: Number(guestCount),
        items: [],
      });
      return data.data;
    },
    onSuccess: (order) => {
      queryClient.setQueryData<OrderView[]>(["orders", "active", table.id], (prev) => [...(prev ?? []), order]);
      patchTableStatus(queryClient, table.id, TableStatus.OCCUPIED);
      onCreated?.(order);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(guestCount);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setValidationError("Ingresá una cantidad de personas válida (mínimo 1).");
      return;
    }
    setValidationError(null);
    openTable.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="guestCount">Personas *</Label>
        <Input
          id="guestCount"
          type="number"
          min={1}
          step={1}
          value={guestCount}
          onChange={(event) => setGuestCount(event.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="client">Cliente</Label>
        <Input id="client" disabled placeholder="Buscar cliente..." className="mt-1" />
      </div>

      <div>
        <Label htmlFor="assignedTo">Camarero</Label>
        <StaffPicker id="assignedTo" value={assignedToId} onChange={setAssignedToId} className="mt-1 w-full" />
      </div>

      {validationError && <p className="text-sm text-red-600">{validationError}</p>}
      {openTable.isError && <p className="text-sm text-red-600">No se pudo abrir la mesa.</p>}

      <Button type="submit" disabled={openTable.isPending}>
        Abrir Mesa
      </Button>
    </form>
  );
}
