import { useEffect, useState } from "react";
import { CashMovementType, Module, PaymentMethodExtended, UserRole } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useCurrentUser } from "@/hooks/useAuth";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
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

interface StaffRef {
  id: string;
  name: string | null;
  username: string;
}

interface CashMovementItem {
  id: string;
  type: CashMovementType;
  method: PaymentMethodExtended;
  amount: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
}

interface CashSessionDetail {
  id: string;
  status: "OPEN" | "CLOSED";
  openingAmount: string;
  closingAmount: string | null;
  expectedAmount: string | null;
  variance: string | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  movements: CashMovementItem[];
  openedBy: StaffRef | null;
  closedBy: StaffRef | null;
}

interface SectorItem {
  id: string;
  name: string;
}

const MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  [CashMovementType.INCOME]: "Ingreso",
  [CashMovementType.EXPENSE]: "Egreso",
  [CashMovementType.SALE]: "Venta",
  [CashMovementType.REFUND]: "Reembolso",
  [CashMovementType.CORRECTION]: "Ajuste",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethodExtended, string> = {
  [PaymentMethodExtended.CASH]: "Efectivo",
  [PaymentMethodExtended.CARD_DEBIT]: "Débito",
  [PaymentMethodExtended.CARD_CREDIT]: "Crédito",
  [PaymentMethodExtended.TRANSFER]: "Transferencia",
  [PaymentMethodExtended.PAYMENT_LINK]: "Link de pago",
  [PaymentMethodExtended.QR_CODE]: "QR",
  [PaymentMethodExtended.ACCOUNT]: "Cuenta corriente",
};

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
    cell: ({ row }) => (row.original.sessions[0] ? `$${row.original.sessions[0]!.openingAmount}` : "—"),
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

  const [openingAmount, setOpeningAmount] = useState("0");
  const [openedById, setOpenedById] = useState<string | undefined>(undefined);

  const [closingAmount, setClosingAmount] = useState("0");
  const [closedById, setClosedById] = useState<string | undefined>(undefined);

  useEffect(() => {
    setActiveSessionId(panel.selected?.sessions[0]?.id ?? null);
  }, [panel.selected]);

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
      await apiClient.patch(`/cash-sessions/${activeSessionId}/close`, {
        closingAmount: Number(closingAmount),
        closedById,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-session", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setClosingAmount("0");
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
        {!creatingRegister && (
          <Button size="sm" variant="outline" onClick={() => setCreatingRegister(true)}>
            <Plus className="h-4 w-4" /> Caja
          </Button>
        )}
      </div>

      {creatingRegister && (
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

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.name}>
        {panel.selected && !activeSessionId && (
          <div className="flex flex-col gap-4">
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

        {panel.selected && activeSessionId && isSessionLoading && <p className="text-sm text-neutral-500">Cargando...</p>}

        {panel.selected && session && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Abierta por</p>
                <p className="text-neutral-900">{session.openedBy?.name ?? session.openedBy?.username ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Monto de apertura</p>
                <p className="text-neutral-900">${session.openingAmount}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Movimientos</p>
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                {session.movements.length === 0 && <p className="text-neutral-500">Sin movimientos todavía.</p>}
                {session.movements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between border-b border-neutral-100 py-1">
                    <span>
                      {MOVEMENT_TYPE_LABELS[movement.type]} · {PAYMENT_METHOD_LABELS[movement.method]}
                    </span>
                    <span className="font-medium">${movement.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {session.status === "OPEN" && (
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
                <p className="text-xs font-medium uppercase text-neutral-500">Cerrar caja</p>
                <Input
                  type="number"
                  min={0}
                  placeholder="Monto contado"
                  value={closingAmount}
                  onChange={(event) => setClosingAmount(event.target.value)}
                />
                <StaffPicker value={closedById} onChange={setClosedById} />
                <Button size="sm" onClick={() => closeSession.mutate()} disabled={closeSession.isPending}>
                  Cerrar caja
                </Button>
              </div>
            )}

            {session.status === "CLOSED" && (
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
                <p className="text-xs font-medium uppercase text-neutral-500">Resultado del arqueo</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-neutral-500">Esperado</span>
                  <span className="text-right font-medium">${session.expectedAmount}</span>
                  <span className="text-neutral-500">Contado</span>
                  <span className="text-right font-medium">${session.closingAmount}</span>
                  <span className="text-neutral-500">Diferencia</span>
                  <span
                    className={cn(
                      "text-right font-semibold",
                      Number(session.variance) === 0
                        ? "text-neutral-900"
                        : Number(session.variance) > 0
                          ? "text-emerald-600"
                          : "text-red-600",
                    )}
                  >
                    ${session.variance}
                  </span>
                </div>
                {user?.role === UserRole.ADMIN && (
                  <Button size="sm" variant="outline" onClick={() => reopenSession.mutate()} disabled={reopenSession.isPending}>
                    Reabrir caja
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
