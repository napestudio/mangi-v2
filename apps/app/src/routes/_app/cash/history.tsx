import { useState } from "react";
import { Module } from "@mangiar/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { MethodCountsTable } from "@/components/cash/MethodCountsTable";
import { MovementsList } from "@/components/cash/MovementsList";
import { PrintSessionButton } from "@/components/cash/PrintSessionButton";
import type { CashSessionDetail } from "@/components/cash/types";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface CashRegisterOption {
  id: string;
  name: string;
}

function varianceClass(variance: number): string {
  if (variance === 0) return "text-neutral-900";
  return variance > 0 ? "text-emerald-600" : "text-red-600";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function staffLabel(staff: { name: string | null; username: string } | null): string {
  return staff?.name ?? staff?.username ?? "—";
}

export const Route = createFileRoute("/_app/cash/history")({
  component: () => (
    <ModuleGuard module={Module.CASH}>
      <CashHistoryPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<CashSessionDetail>[] = [
  {
    id: "openedAt",
    header: "Apertura",
    cell: ({ row }) => formatDateTime(row.original.openedAt),
  },
  {
    id: "closedAt",
    header: "Cierre",
    cell: ({ row }) => (row.original.status === "OPEN" ? "En curso" : formatDateTime(row.original.closedAt)),
  },
  {
    id: "openedBy",
    header: "Abrió",
    cell: ({ row }) => staffLabel(row.original.openedBy),
  },
  {
    id: "closedBy",
    header: "Cerró",
    cell: ({ row }) => (row.original.status === "OPEN" ? "—" : staffLabel(row.original.closedBy)),
  },
  {
    id: "status",
    header: "Estado",
    cell: ({ row }) => (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          row.original.status === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600",
        )}
      >
        {row.original.status === "OPEN" ? "Abierta" : "Cerrada"}
      </span>
    ),
  },
  {
    id: "closingAmount",
    header: "Contado",
    cell: ({ row }) => (row.original.closingAmount ? formatPrice(row.original.closingAmount) : "—"),
  },
  {
    id: "variance",
    header: "Diferencia",
    cell: ({ row }) =>
      row.original.variance ? (
        <span className={cn("font-medium", varianceClass(Number(row.original.variance)))}>
          {formatPrice(row.original.variance)}
        </span>
      ) : (
        "—"
      ),
  },
];

function CashHistoryPage() {
  const [registerId, setRegisterId] = useState<string>("");
  const panel = useSidePanel<CashSessionDetail>();

  const { data: registers } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashRegisterOption[]>>("/cash-registers");
      return data.data;
    },
  });

  const effectiveRegisterId = registerId || registers?.[0]?.id || "";

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["cash-sessions", effectiveRegisterId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashSessionDetail[]>>(
        `/cash-registers/${effectiveRegisterId}/sessions`,
      );
      return data.data;
    },
    enabled: !!effectiveRegisterId,
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Historial de caja</h1>
        <Link to="/cash">
          <Button size="sm" variant="outline">
            Volver a Cajas
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="historyRegister">Caja</Label>
        <select
          id="historyRegister"
          className="h-10 w-64 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          value={effectiveRegisterId}
          onChange={(event) => setRegisterId(event.target.value)}
        >
          {(registers ?? []).map((register) => (
            <option key={register.id} value={register.id}>
              {register.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={sessions ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="Esta caja todavía no tiene sesiones."
        className="flex-1"
      />

      <SidePanel
        open={panel.isOpen}
        onClose={panel.close}
        title={panel.selected ? formatDateTime(panel.selected.openedAt) : ""}
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        {panel.selected && (
          <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Apertura</p>
                <p className="text-neutral-900">{formatDateTime(panel.selected.openedAt)}</p>
                <p className="text-xs text-neutral-500">{staffLabel(panel.selected.openedBy)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Cierre</p>
                <p className="text-neutral-900">
                  {panel.selected.status === "OPEN" ? "En curso" : formatDateTime(panel.selected.closedAt)}
                </p>
                {panel.selected.status === "CLOSED" && (
                  <p className="text-xs text-neutral-500">{staffLabel(panel.selected.closedBy)}</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Movimientos</p>
              <MovementsList movements={panel.selected.movements} />
            </div>

            {panel.selected.status === "CLOSED" && (
              <div className="flex flex-col gap-3 border-t border-neutral-200 pt-3">
                {panel.selected.methodCounts.length > 0 && (
                  <>
                    <p className="text-xs font-medium uppercase text-neutral-500">Arqueo por método de pago</p>
                    <MethodCountsTable counts={panel.selected.methodCounts} />
                  </>
                )}
                <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-2 text-sm">
                  <span className="text-neutral-500">Esperado</span>
                  <span className="text-right font-medium">{formatPrice(panel.selected.expectedAmount!)}</span>
                  <span className="text-neutral-500">Contado</span>
                  <span className="text-right font-medium">{formatPrice(panel.selected.closingAmount!)}</span>
                  <span className="text-neutral-500">Diferencia</span>
                  <span className={cn("text-right font-semibold", varianceClass(Number(panel.selected.variance)))}>
                    {formatPrice(panel.selected.variance!)}
                  </span>
                </div>
                <PrintSessionButton sessionId={panel.selected.id} />
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
