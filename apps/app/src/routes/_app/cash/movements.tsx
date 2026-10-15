import { useState } from "react";
import { CashMovementType, Module, PaymentMethodExtended } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { isAxiosError } from "axios";
import { Plus } from "lucide-react";
import { formatTime } from "@/components/cash/datetime";
import { MOVEMENT_TYPE_LABELS, type CashMovementListItem } from "@/components/cash/types";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";

interface CashRegisterOption {
  id: string;
  name: string;
  sessions: { id: string }[];
}

const MANUAL_MOVEMENT_TYPES = [CashMovementType.INCOME, CashMovementType.EXPENSE] as const;

interface MovementFormState {
  amount: string;
  type: CashMovementType;
  method: PaymentMethodExtended;
  cashRegisterId: string;
  description: string;
  createdById: string | undefined;
}

function emptyForm(firstRegisterId: string): MovementFormState {
  return {
    amount: "",
    type: CashMovementType.INCOME,
    method: PaymentMethodExtended.CASH,
    cashRegisterId: firstRegisterId,
    description: "",
    createdById: undefined,
  };
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

export const Route = createFileRoute("/_app/cash/movements")({
  component: () => (
    <ModuleGuard module={Module.CASH}>
      <CashMovementsPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<CashMovementListItem>[] = [
  {
    id: "createdAt",
    header: "Fecha",
    cell: ({ row }) => `${new Date(row.original.createdAt).toLocaleDateString("es-AR")} ${formatTime(row.original.createdAt)}`,
  },
  {
    id: "type",
    header: "Tipo",
    cell: ({ row }) => MOVEMENT_TYPE_LABELS[row.original.type],
  },
  {
    id: "method",
    header: "Medio de pago",
    cell: ({ row }) => PAYMENT_METHOD_LABELS[row.original.method],
  },
  {
    id: "cashRegister",
    header: "Caja",
    cell: ({ row }) => row.original.session.cashRegister.name,
  },
  {
    id: "amount",
    header: "Monto",
    cell: ({ row }) => formatPrice(row.original.amount),
  },
  {
    id: "createdBy",
    header: "Quién",
    cell: ({ row }) => row.original.createdBy?.name ?? row.original.createdBy?.username ?? "—",
  },
];

function CashMovementsPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<CashMovementListItem>();

  const [filterRegisterId, setFilterRegisterId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<MovementFormState>(emptyForm(""));

  const { data: registers } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashRegisterOption[]>>("/cash-registers");
      return data.data;
    },
  });

  const openRegisters = (registers ?? []).filter((register) => register.sessions.length > 0);

  const { data: movements, isLoading } = useQuery({
    queryKey: ["cash-movements", { filterRegisterId, filterType, filterFrom, filterTo }],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashMovementListItem[]>>("/cash-movements", {
        params: {
          cashRegisterId: filterRegisterId || undefined,
          type: filterType || undefined,
          from: filterFrom || undefined,
          to: filterTo || undefined,
        },
      });
      return data.data;
    },
  });

  const createMovement = useMutation({
    mutationFn: async () => {
      const session = openRegisters.find((register) => register.id === form.cashRegisterId)?.sessions[0];
      if (!session) throw new Error("No open session for the selected register");
      await apiClient.post(`/cash-sessions/${session.id}/movements`, {
        type: form.type,
        method: form.method,
        amount: Number(form.amount),
        description: form.description || undefined,
        createdById: form.createdById,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
      closePanel();
    },
  });

  function openCreate() {
    panel.close();
    setForm(emptyForm(openRegisters[0]?.id ?? ""));
    createMovement.reset();
    setIsCreating(true);
  }

  function closePanel() {
    panel.close();
    setIsCreating(false);
    createMovement.reset();
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Movimientos de caja</h1>
          <p className="text-sm text-neutral-500">
            Ingresos y egresos manuales (ej. un cobro aparte o un pago hecho con la plata de la caja) — no incluye ventas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/cash">
            <Button size="sm" variant="outline">
              Volver a Cajas
            </Button>
          </Link>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Movimiento
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filterRegister">Caja</Label>
          <select
            id="filterRegister"
            className="h-10 w-48 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            value={filterRegisterId}
            onChange={(event) => setFilterRegisterId(event.target.value)}
          >
            <option value="">Todas</option>
            {(registers ?? []).map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filterType">Tipo</Label>
          <select
            id="filterType"
            className="h-10 w-44 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="">Todos</option>
            {MANUAL_MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {MOVEMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filterFrom">Desde</Label>
          <Input
            id="filterFrom"
            type="date"
            className="h-10 w-40"
            value={filterFrom}
            onChange={(event) => setFilterFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filterTo">Hasta</Label>
          <Input
            id="filterTo"
            type="date"
            className="h-10 w-40"
            value={filterTo}
            onChange={(event) => setFilterTo(event.target.value)}
          />
        </div>
        {(filterRegisterId || filterType || filterFrom || filterTo) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilterRegisterId("");
              setFilterType("");
              setFilterFrom("");
              setFilterTo("");
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={movements ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No se encontraron movimientos con los filtros seleccionados."
        className="flex-1"
      />

      <SidePanel
        open={panel.isOpen || isCreating}
        onClose={closePanel}
        title={isCreating ? "Nuevo movimiento de caja" : "Movimiento de caja"}
      >
        {isCreating && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-500">Registrá un ingreso o egreso manual en una caja abierta.</p>
            {openRegisters.length === 0 ? (
              <p className="text-sm text-red-600">No hay ninguna caja abierta en este momento.</p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movAmount">Monto</Label>
                  <Input
                    id="movAmount"
                    type="number"
                    min={0}
                    value={form.amount}
                    onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movType">Tipo</Label>
                  <select
                    id="movType"
                    className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                    value={form.type}
                    onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as CashMovementType }))}
                  >
                    {MANUAL_MOVEMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {MOVEMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movMethod">Medio de pago</Label>
                  <select
                    id="movMethod"
                    className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                    value={form.method}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, method: event.target.value as PaymentMethodExtended }))
                    }
                  >
                    {Object.values(PaymentMethodExtended).map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movRegister">Caja</Label>
                  <select
                    id="movRegister"
                    className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                    value={form.cashRegisterId}
                    onChange={(event) => setForm((prev) => ({ ...prev, cashRegisterId: event.target.value }))}
                  >
                    {openRegisters.map((register) => (
                      <option key={register.id} value={register.id}>
                        {register.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movCreatedBy">Registrado por</Label>
                  <StaffPicker
                    id="movCreatedBy"
                    value={form.createdById}
                    onChange={(id) => setForm((prev) => ({ ...prev, createdById: id }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movDescription">Comentario (opcional)</Label>
                  <textarea
                    id="movDescription"
                    className="min-h-20 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                    placeholder="Descripción del movimiento..."
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                {createMovement.isError && (
                  <p className="text-xs text-red-600">
                    {extractErrorMessage(createMovement.error, "No se pudo registrar el movimiento.")}
                  </p>
                )}
                <Button
                  disabled={!form.amount || Number(form.amount) <= 0 || createMovement.isPending}
                  onClick={() => createMovement.mutate()}
                >
                  Agregar movimiento
                </Button>
              </>
            )}
          </div>
        )}

        {!isCreating && panel.selected && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Tipo</dt>
              <dd className="text-neutral-900">{MOVEMENT_TYPE_LABELS[panel.selected.type]}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Monto</dt>
              <dd className="font-semibold text-neutral-900">{formatPrice(panel.selected.amount)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Medio de pago</dt>
              <dd className="text-neutral-900">{PAYMENT_METHOD_LABELS[panel.selected.method]}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Caja</dt>
              <dd className="text-neutral-900">{panel.selected.session.cashRegister.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Fecha</dt>
              <dd className="text-neutral-900">{new Date(panel.selected.createdAt).toLocaleString("es-AR")}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Registrado por</dt>
              <dd className="text-neutral-900">
                {panel.selected.createdBy?.name ?? panel.selected.createdBy?.username ?? "—"}
              </dd>
            </div>
            {panel.selected.description && (
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-neutral-500">Comentario</dt>
                <dd className="text-neutral-900">{panel.selected.description}</dd>
              </div>
            )}
          </dl>
        )}
      </SidePanel>
    </div>
  );
}
