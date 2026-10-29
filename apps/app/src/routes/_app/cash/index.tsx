import { useMemo, useState } from "react";
import { computeExpectedByMethod, Module, type PaymentMethodExtended, UserRole } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { isAxiosError } from "axios";
import { Plus } from "lucide-react";
import { MethodCountsTable } from "@/components/cash/MethodCountsTable";
import { MovementsList } from "@/components/cash/MovementsList";
import { PrintSessionButton } from "@/components/cash/PrintSessionButton";
import type { CashSessionDetail } from "@/components/cash/types";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useCurrentUser } from "@/hooks/useAuth";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

interface SectorRef {
  sector: { id: string; name: string };
}

interface SessionRef {
  id: string;
  status: "OPEN" | "CLOSED";
  openingAmount: string;
  openedAt: string;
}

interface CashRegisterItem {
  id: string;
  name: string;
  isActive: boolean;
  sectors: SectorRef[];
  sessions: SessionRef[];
}

interface SectorItem {
  id: string;
  name: string;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

function varianceClass(variance: number): string {
  if (variance === 0) return "text-neutral-900";
  return variance > 0 ? "text-emerald-600" : "text-red-600";
}

export const Route = createFileRoute("/_app/cash/")({
  component: () => (
    <ModuleGuard module={Module.CASH}>
      <CashPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<CashRegisterItem>[] = [
  { accessorKey: "name", header: "Caja" },
  {
    id: "sectors",
    header: "Sectores",
    cell: ({ row }) => row.original.sectors.map((s) => s.sector.name).join(", ") || "—",
  },
  {
    id: "status",
    header: "Estado",
    cell: ({ row }) => {
      const open = row.original.sessions[0];
      return (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            open ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600",
          )}
        >
          {open ? "Abierta" : "Cerrada"}
        </span>
      );
    },
  },
  {
    id: "openingAmount",
    header: "Apertura",
    cell: ({ row }) => (row.original.sessions[0] ? formatPrice(row.original.sessions[0]!.openingAmount) : "—"),
  },
];

function CashPage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const panel = useSidePanel<CashRegisterItem>();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [creatingRegister, setCreatingRegister] = useState(false);
  const [newRegisterName, setNewRegisterName] = useState("");
  const [newRegisterSectorIds, setNewRegisterSectorIds] = useState<string[]>([]);

  const [prevSelected, setPrevSelected] = useState(panel.selected);

  const [openingAmount, setOpeningAmount] = useState("0");
  const [openedById, setOpenedById] = useState<string | undefined>(undefined);

  const [closingSession, setClosingSession] = useState(false);
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [closedById, setClosedById] = useState<string | undefined>(undefined);

  if (panel.selected !== prevSelected) {
    setPrevSelected(panel.selected);
    setActiveSessionId(panel.selected?.sessions[0]?.id ?? null);
    setClosingSession(false);
    setCountInputs({});
    setClosedById(undefined);
  }

  const { data: registers, isLoading } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashRegisterItem[]>>("/cash-registers");
      return data.data;
    },
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SectorItem[]>>("/sectors");
      return data.data;
    },
  });

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ["cash-session", activeSessionId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashSessionDetail>>(`/cash-sessions/${activeSessionId}`);
      return data.data;
    },
    enabled: !!activeSessionId,
  });

  const expectedByMethod = useMemo(
    () =>
      session
        ? computeExpectedByMethod(
            Number(session.openingAmount),
            session.movements.map((movement) => ({ ...movement, amount: Number(movement.amount) })),
          )
        : {},
    [session],
  );
  const methodsToCount = Object.keys(expectedByMethod) as PaymentMethodExtended[];
  const allCounted =
    methodsToCount.length > 0 && methodsToCount.every((method) => (countInputs[method] ?? "").trim() !== "");

  const createRegister = useMutation({
    mutationFn: async () => {
      await apiClient.post("/cash-registers", { name: newRegisterName, sectorIds: newRegisterSectorIds });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setCreatingRegister(false);
      setNewRegisterName("");
      setNewRegisterSectorIds([]);
    },
  });

  const openSession = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiEnvelope<{ id: string }>>(`/cash-registers/${panel.selected!.id}/sessions`, {
        openingAmount: Number(openingAmount),
        openedById,
      });
      return data.data;
    },
    onSuccess: (newSession) => {
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setActiveSessionId(newSession.id);
      setOpeningAmount("0");
      setOpenedById(undefined);
    },
  });

  const closeSession = useMutation({
    mutationFn: async () => {
      const counts = methodsToCount.map((method) => ({
        method,
        countedAmount: Number(countInputs[method] ?? 0),
      }));
      await apiClient.patch(`/cash-sessions/${activeSessionId}/close`, { counts, closedById });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-session", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setClosingSession(false);
      setCountInputs({});
      setClosedById(undefined);
    },
  });

  const reopenSession = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/cash-sessions/${activeSessionId}/reopen`, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-session", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
    },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Cajas</h1>
        <div className="flex items-center gap-2">
          <Link to="/cash/movements">
            <Button size="sm" variant="outline">
              Movimientos
            </Button>
          </Link>
          <Link to="/cash/history">
            <Button size="sm" variant="outline">
              Ver historial
            </Button>
          </Link>
          {registers && registers.length === 0 && !creatingRegister && (
            <Button size="sm" variant="outline" onClick={() => setCreatingRegister(true)}>
              <Plus className="h-4 w-4" /> Caja
            </Button>
          )}
        </div>
      </div>

      {registers && registers.length === 0 && creatingRegister && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="registerName">Nombre</Label>
              <Input
                id="registerName"
                autoFocus
                value={newRegisterName}
                onChange={(event) => setNewRegisterName(event.target.value)}
                className="h-9 w-48"
              />
            </div>
            <Button size="sm" disabled={!newRegisterName.trim() || createRegister.isPending} onClick={() => createRegister.mutate()}>
              Crear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreatingRegister(false)}>
              Cancelar
            </Button>
          </div>
          {sectors && sectors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sectors.map((sector) => (
                <label key={sector.id} className="flex items-center gap-1.5 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={newRegisterSectorIds.includes(sector.id)}
                    onChange={(event) =>
                      setNewRegisterSectorIds((prev) =>
                        event.target.checked ? [...prev, sector.id] : prev.filter((id) => id !== sector.id),
                      )
                    }
                  />
                  {sector.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={registers ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay cajas todavía."
        className="flex-1"
      />

      <SidePanel
        open={panel.isOpen}
        onClose={panel.close}
        title={panel.selected?.name}
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        {panel.selected && !activeSessionId && (
          <div className="flex h-full flex-col gap-4 px-6 py-4">
            <p className="text-sm text-neutral-500">Esta caja está cerrada. Abrila para empezar a registrar movimientos.</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="openingAmount">Monto de apertura</Label>
              <Input
                id="openingAmount"
                type="number"
                min={0}
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="openedBy">Abierta por</Label>
              <StaffPicker id="openedBy" value={openedById} onChange={setOpenedById} />
            </div>
            <Button onClick={() => openSession.mutate()} disabled={openSession.isPending}>
              Abrir caja
            </Button>
          </div>
        )}

        {panel.selected && activeSessionId && isSessionLoading && (
          <p className="px-6 py-4 text-sm text-neutral-500">Cargando...</p>
        )}

        {panel.selected && session && session.status === "OPEN" && !closingSession && (
          <div className="flex h-full min-h-0 flex-col gap-4 px-6 py-4">
            <div className="grid shrink-0 grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Abierta por</p>
                <p className="text-neutral-900">{session.openedBy?.name ?? session.openedBy?.username ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Monto de apertura</p>
                <p className="text-neutral-900">{formatPrice(session.openingAmount)}</p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <p className="mb-2 shrink-0 text-xs font-medium uppercase text-neutral-500">Movimientos</p>
              <div className="flex-1 overflow-y-auto">
                <MovementsList movements={session.movements} />
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200 pt-3">
              <PrintSessionButton sessionId={session.id} />
              <Button className="w-full" onClick={() => setClosingSession(true)}>
                Cerrar caja
              </Button>
            </div>
          </div>
        )}

        {panel.selected && session && session.status === "OPEN" && closingSession && (
          <div className="flex h-full min-h-0 flex-col gap-4 px-6 py-4">
            <p className="shrink-0 text-xs font-medium uppercase text-neutral-500">Cerrar caja — arqueo</p>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {methodsToCount.map((method) => {
                const expected = expectedByMethod[method] ?? 0;
                const countedRaw = countInputs[method] ?? "";
                const counted = countedRaw.trim() === "" ? null : Number(countedRaw);
                const variance = counted === null ? null : counted - expected;
                return (
                  <div key={method} className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-b-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-neutral-700">{PAYMENT_METHOD_LABELS[method]}</span>
                      <span className="text-neutral-500">Esperado: {formatPrice(expected)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Contado"
                        value={countedRaw}
                        onChange={(event) => setCountInputs((prev) => ({ ...prev, [method]: event.target.value }))}
                        className="h-9"
                      />
                      {variance !== null && (
                        <span className={cn("w-28 shrink-0 text-right text-sm font-medium", varianceClass(variance))}>
                          {formatPrice(variance)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <StaffPicker value={closedById} onChange={setClosedById} />
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200 pt-3">
              {closeSession.isError && (
                <p className="text-xs text-red-600">{extractErrorMessage(closeSession.error, "No se pudo cerrar la caja.")}</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setClosingSession(false);
                    setCountInputs({});
                    closeSession.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" disabled={closeSession.isPending || !allCounted} onClick={() => closeSession.mutate()}>
                  Cerrar caja
                </Button>
              </div>
            </div>
          </div>
        )}

        {panel.selected && session && session.status === "CLOSED" && (
          <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-4">
            <p className="text-xs font-medium uppercase text-neutral-500">Resultado del arqueo</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-neutral-500">Apertura</p>
                <p>{new Date(session.openedAt).toLocaleString("es-AR")}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Cierre</p>
                <p>{session.closedAt ? new Date(session.closedAt).toLocaleString("es-AR") : "—"}</p>
              </div>
            </div>
            <MethodCountsTable counts={session.methodCounts} />
            <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-2 text-sm">
              <span className="text-neutral-500">Esperado</span>
              <span className="text-right font-medium">{formatPrice(session.expectedAmount!)}</span>
              <span className="text-neutral-500">Contado</span>
              <span className="text-right font-medium">{formatPrice(session.closingAmount!)}</span>
              <span className="text-neutral-500">Diferencia</span>
              <span className={cn("text-right font-semibold", varianceClass(Number(session.variance)))}>
                {formatPrice(session.variance!)}
              </span>
            </div>
            <PrintSessionButton sessionId={session.id} />
            {user?.role === UserRole.ADMIN && (
              <Button size="sm" variant="outline" onClick={() => reopenSession.mutate()} disabled={reopenSession.isPending}>
                Reabrir caja
              </Button>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
