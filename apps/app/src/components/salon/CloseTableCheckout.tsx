import { useEffect, useMemo, useState } from "react";
import { Module, PaymentMethodExtended } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { OrderView } from "./types";

interface CashRegisterWithOpenSession {
  id: string;
  name: string;
  sectors: { sector: { id: string } }[];
  sessions: { id: string }[];
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethodExtended, string> = {
  [PaymentMethodExtended.CASH]: "Efectivo",
  [PaymentMethodExtended.CARD_DEBIT]: "Débito",
  [PaymentMethodExtended.CARD_CREDIT]: "Crédito",
  [PaymentMethodExtended.TRANSFER]: "Transferencia",
  [PaymentMethodExtended.PAYMENT_LINK]: "Link de pago",
  [PaymentMethodExtended.QR_CODE]: "QR",
  [PaymentMethodExtended.ACCOUNT]: "Cuenta corriente",
};

interface CloseTableCheckoutProps {
  order: OrderView;
  onCancel: () => void;
  onClosed: () => void;
}

export function CloseTableCheckout({ order, onCancel, onClosed }: CloseTableCheckoutProps) {
  const { hasModule } = useModules();
  const queryClient = useQueryClient();
  const [paymentMethodExt, setPaymentMethodExt] = useState<PaymentMethodExtended>(PaymentMethodExtended.CASH);
  const [sessionId, setSessionId] = useState("");

  const { data: registers } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashRegisterWithOpenSession[]>>("/cash-registers");
      return data.data;
    },
    enabled: hasModule(Module.CASH),
  });

  const { data: table } = useQuery({
    queryKey: ["table", order.tableId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<{ id: string; sectorId: string }>>(`/tables/${order.tableId}`);
      return data.data;
    },
    enabled: hasModule(Module.CASH) && !!order.tableId,
  });

  const openSessions = useMemo(
    () =>
      registers?.filter((register) => register.sessions.length > 0).map((register) => ({
        id: register.sessions[0]!.id,
        label: register.name,
        sectorIds: register.sectors.map((s) => s.sector.id),
      })) ?? [],
    [registers],
  );

  // Preselecciona la caja asignada al sector de la mesa que se está cerrando — ver mangiar-cash.
  useEffect(() => {
    if (sessionId || !table) return;
    const match = openSessions.find((session) => session.sectorIds.includes(table.sectorId));
    if (match) setSessionId(match.id);
  }, [table, openSessions, sessionId]);

  const checkout = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/orders/${order.id}/checkout`, {
        paymentMethodExt,
        sessionId: hasModule(Module.CASH) ? sessionId || undefined : undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      onClosed();
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500">Método de pago</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(PaymentMethodExtended).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethodExt(method)}
              className={cn(
                "rounded-md border px-2 py-2 text-sm font-medium",
                paymentMethodExt === method
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 text-neutral-700 hover:border-neutral-400",
              )}
            >
              {PAYMENT_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
      </div>

      {hasModule(Module.CASH) && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500">Caja</p>
          <select
            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
          >
            <option value="">Sin registrar en caja</option>
            {openSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {checkout.isError && <p className="text-sm text-red-600">No se pudo cerrar la mesa.</p>}

      <div className="flex gap-2">
        <Button className="h-12 flex-1 text-base" disabled={checkout.isPending} onClick={() => checkout.mutate()}>
          Confirmar cobro
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Volver
        </Button>
      </div>
    </div>
  );
}
