import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface StockMovementItem {
  id: string;
  quantity: string;
  previousStock: string;
  newStock: string;
  reason: string;
  createdAt: string;
  createdBy: { id: string; name: string | null; username: string } | null;
}

interface StockSectionProps {
  productId?: string;
  ingredientId?: string;
  currentStock: string | number;
  invalidateKey: string[];
}

export function StockSection({ productId, ingredientId, currentStock, invalidateKey }: StockSectionProps) {
  const queryClient = useQueryClient();
  const movementsKey = ["stock-movements", productId ?? ingredientId];

  const { data: movements, isLoading } = useQuery({
    queryKey: movementsKey,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<StockMovementItem[]>>("/stock/movements", {
        params: { productId, ingredientId },
      });
      return data.data;
    },
  });

  const [mode, setMode] = useState<"adjust" | "set">("adjust");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [attributedToId, setAttributedToId] = useState<string | undefined>(undefined);

  const submit = useMutation({
    mutationFn: async (sign?: 1 | -1) => {
      const payload = { productId, ingredientId, reason: reason.trim() || undefined, attributedToId };
      if (mode === "adjust") {
        await apiClient.post("/stock/adjust", { ...payload, delta: (sign ?? 1) * Number(amount) });
      } else {
        await apiClient.post("/stock/set", { ...payload, stock: Number(amount) });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: movementsKey });
      void queryClient.invalidateQueries({ queryKey: invalidateKey });
      setAmount("");
      setReason("");
    },
  });

  return (
    <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
      <div>
        <p className="text-xs font-medium uppercase text-neutral-500">Stock actual</p>
        <p className="text-lg font-semibold text-neutral-900">{currentStock}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("adjust")}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium",
              mode === "adjust" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600",
            )}
          >
            Sumar / Restar
          </button>
          <button
            type="button"
            onClick={() => setMode("set")}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium",
              mode === "set" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600",
            )}
          >
            Fijar valor
          </button>
        </div>
        <Input
          type="number"
          min={0}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={mode === "adjust" ? "Cantidad" : "Nuevo stock"}
        />
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motivo (opcional, ej: merma, conteo)"
        />
        <StaffPicker value={attributedToId} onChange={setAttributedToId} />
        {mode === "adjust" ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => submit.mutate(-1)}
              disabled={!amount || submit.isPending}
            >
              <Minus className="h-4 w-4" /> Quitar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => submit.mutate(1)}
              disabled={!amount || submit.isPending}
            >
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => submit.mutate()} disabled={!amount || submit.isPending}>
            Registrar movimiento
          </Button>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase text-neutral-500">Historial</p>
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
          {isLoading && <p className="text-neutral-500">Cargando...</p>}
          {movements && movements.length === 0 && <p className="text-neutral-500">Sin movimientos todavía.</p>}
          {movements?.map((movement) => (
            <div key={movement.id} className="flex items-center justify-between border-b border-neutral-100 py-1">
              <div>
                <p className="text-neutral-900">{movement.reason}</p>
                <p className="text-neutral-500">{movement.createdBy?.name ?? movement.createdBy?.username ?? "—"}</p>
              </div>
              <span className={cn("font-medium", Number(movement.quantity) >= 0 ? "text-emerald-600" : "text-red-600")}>
                {Number(movement.quantity) >= 0 ? "+" : ""}
                {movement.quantity} ({movement.previousStock}→{movement.newStock})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
