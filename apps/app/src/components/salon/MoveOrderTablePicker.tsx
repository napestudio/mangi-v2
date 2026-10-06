import { useMemo, useState } from "react";
import { TableStatus } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { STATUS_STYLES, type FloorPlanTable } from "./FloorPlanCanvas";
import { patchTableStatus } from "./tableCache";
import type { OrderView } from "./types";

interface TableWithSector extends FloorPlanTable {
  sectorId: string;
}

interface SectorOption {
  id: string;
  name: string;
}

interface MoveOrderTablePickerProps {
  order: OrderView;
  /** Solo se usa el `id` (para excluir la mesa actual de la grilla de destino). */
  currentTable: { id: string };
  onCancel: () => void;
  onMoved: () => void;
}

export function MoveOrderTablePicker({ order, currentTable, onCancel, onMoved }: MoveOrderTablePickerProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingTable, setPendingTable] = useState<TableWithSector | null>(null);

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SectorOption[]>>("/sectors");
      return data.data;
    },
  });

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables", "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TableWithSector[]>>("/tables");
      return data.data;
    },
  });

  const tablesBySector = useMemo(() => {
    const groups = new Map<string, TableWithSector[]>();
    for (const table of tables ?? []) {
      if (table.id === currentTable.id) continue;
      const list = groups.get(table.sectorId) ?? [];
      list.push(table);
      groups.set(table.sectorId, list);
    }
    return groups;
  }, [tables, currentTable.id]);

  const moveOrder = useMutation({
    mutationFn: async (destinationTableId: string) => {
      const { data } = await apiClient.patch<ApiEnvelope<OrderView>>(`/orders/${order.id}/table`, {
        tableId: destinationTableId,
      });
      return data.data;
    },
    onSuccess: (_updated, destinationTableId) => {
      patchTableStatus(queryClient, destinationTableId, TableStatus.OCCUPIED);
      void queryClient.invalidateQueries({ queryKey: ["orders", "active", destinationTableId] });
      const destination = tables?.find((t) => t.id === destinationTableId);
      toast.show({ message: `Pedido movido a Mesa ${destination?.number ?? ""}`, variant: "success" });
      onMoved();
    },
    onError: () => {
      toast.show({ message: "No se pudo mover el pedido.", variant: "error" });
    },
  });

  function handlePick(table: TableWithSector) {
    if (table.status === TableStatus.EMPTY) {
      moveOrder.mutate(table.id);
    } else {
      setPendingTable(table);
    }
  }

  if (pendingTable) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-700">
          La mesa <span className="font-semibold">{pendingTable.number}</span> ya está ocupada. ¿Mover el pedido igual?
        </p>
        {moveOrder.isError && <p className="text-sm text-red-600">No se pudo mover el pedido.</p>}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => setPendingTable(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={moveOrder.isPending}
            onClick={() => moveOrder.mutate(pendingTable.id)}
          >
            Confirmar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-900">Elegí la mesa destino</p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Cargando mesas...</p>}

      {sectors?.map((sector) => {
        const sectorTables = tablesBySector.get(sector.id) ?? [];
        if (sectorTables.length === 0) return null;
        return (
          <div key={sector.id}>
            <p className="mb-2 text-xs font-medium uppercase text-neutral-500">{sector.name}</p>
            <div className="flex flex-wrap gap-2">
              {sectorTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => handlePick(table)}
                  disabled={moveOrder.isPending}
                  className={cn(
                    "flex h-12 w-12 flex-col items-center justify-center rounded-md border-2 text-xs font-semibold",
                    STATUS_STYLES[table.status],
                  )}
                >
                  {table.number}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
