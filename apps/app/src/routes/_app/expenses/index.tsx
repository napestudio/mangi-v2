import { useState } from "react";
import { ExpenseCategory, Module, PaymentMethodExtended } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface StaffRef {
  id: string;
  name: string | null;
  username: string;
}

interface ExpenseListItem {
  id: string;
  category: ExpenseCategory;
  description: string;
  vendor: string | null;
  amount: string;
  paidMethod: PaymentMethodExtended;
  paidBy: StaffRef | null;
  expenseDate: string;
  notes: string | null;
  cashMovement: { id: string; sessionId: string } | null;
}

interface OpenSessionOption {
  registerId: string;
  registerName: string;
  sessionId: string;
}

interface CashRegisterWithOpenSession {
  id: string;
  name: string;
  sessions: { id: string }[];
}

interface ExpenseFormState {
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: string;
  paidMethod: PaymentMethodExtended;
  paidById: string | undefined;
  notes: string;
  paidFromSessionId: string;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.MAINTENANCE]: "Mantenimiento",
  [ExpenseCategory.UTILITIES]: "Servicios",
  [ExpenseCategory.SUPPLIES]: "Insumos",
  [ExpenseCategory.RENT]: "Alquiler",
  [ExpenseCategory.PAYROLL]: "Sueldos",
  [ExpenseCategory.MARKETING]: "Marketing",
  [ExpenseCategory.TAXES]: "Impuestos",
  [ExpenseCategory.OTHER]: "Otro",
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

function emptyForm(): ExpenseFormState {
  return {
    category: ExpenseCategory.OTHER,
    description: "",
    vendor: "",
    amount: "",
    paidMethod: PaymentMethodExtended.CASH,
    paidById: undefined,
    notes: "",
    paidFromSessionId: "",
  };
}

export const Route = createFileRoute("/_app/expenses/")({
  component: () => (
    <ModuleGuard module={Module.EXPENSES}>
      <ExpensesPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<ExpenseListItem>[] = [
  { id: "date", header: "Fecha", cell: ({ row }) => new Date(row.original.expenseDate).toLocaleDateString("es-AR") },
  { id: "description", header: "Descripción", cell: ({ row }) => row.original.description },
  { id: "category", header: "Categoría", cell: ({ row }) => CATEGORY_LABELS[row.original.category] },
  { id: "vendor", header: "Proveedor", cell: ({ row }) => row.original.vendor ?? "—" },
  {
    id: "source",
    header: "Origen",
    cell: ({ row }) => (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          row.original.cashMovement ? "bg-sky-100 text-sky-800" : "bg-neutral-100 text-neutral-600",
        )}
      >
        {row.original.cashMovement ? "Caja" : "Independiente"}
      </span>
    ),
  },
  { id: "amount", header: "Monto", cell: ({ row }) => `$${row.original.amount}` },
];

function ExpensesPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<ExpenseListItem>();
  const { hasModule } = useModules();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm());

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ExpenseListItem[]>>("/expenses");
      return data.data;
    },
  });

  const { data: registers } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CashRegisterWithOpenSession[]>>("/cash-registers");
      return data.data;
    },
    enabled: hasModule(Module.CASH),
  });

  const openSessions: OpenSessionOption[] =
    registers
      ?.filter((register) => register.sessions.length > 0)
      .map((register) => ({ registerId: register.id, registerName: register.name, sessionId: register.sessions[0]!.id })) ?? [];

  const createExpense = useMutation({
    mutationFn: async () => {
      await apiClient.post("/expenses", {
        category: form.category,
        description: form.description,
        vendor: form.vendor || undefined,
        amount: Number(form.amount),
        paidMethod: form.paidMethod,
        paidById: form.paidById,
        notes: form.notes || undefined,
        paidFromSessionId: form.paidFromSessionId || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setCreating(false);
      setForm(emptyForm());
    },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Gastos</h1>
        {!creating && (
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm());
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> Gasto
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expDescription">Descripción</Label>
              <Input
                id="expDescription"
                autoFocus
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expVendor">Proveedor / a quién se le pagó</Label>
              <Input id="expVendor" value={form.vendor} onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expCategory">Categoría</Label>
              <select
                id="expCategory"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))}
              >
                {Object.values(ExpenseCategory).map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expAmount">Monto</Label>
              <Input
                id="expAmount"
                type="number"
                min={0}
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expMethod">Método de pago</Label>
              <select
                id="expMethod"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                value={form.paidMethod}
                onChange={(event) => setForm((prev) => ({ ...prev, paidMethod: event.target.value as PaymentMethodExtended }))}
              >
                {Object.values(PaymentMethodExtended).map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expPaidBy">Pagado por</Label>
              <StaffPicker id="expPaidBy" value={form.paidById} onChange={(id) => setForm((prev) => ({ ...prev, paidById: id }))} />
            </div>
          </div>

          {hasModule(Module.CASH) && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expSession">Descontar de una caja abierta (opcional)</Label>
              <select
                id="expSession"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                value={form.paidFromSessionId}
                onChange={(event) => setForm((prev) => ({ ...prev, paidFromSessionId: event.target.value }))}
              >
                <option value="">No descontar de caja (gasto independiente)</option>
                {openSessions.map((session) => (
                  <option key={session.sessionId} value={session.sessionId}>
                    {session.registerName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expNotes">Notas</Label>
            <Input id="expNotes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!form.description || !form.amount || createExpense.isPending}
              onClick={() => createExpense.mutate()}
            >
              Registrar gasto
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={expenses ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay gastos cargados."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.description}>
        {panel.selected && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Categoría</dt>
                <dd className="text-neutral-900">{CATEGORY_LABELS[panel.selected.category]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Monto</dt>
                <dd className="font-semibold text-neutral-900">${panel.selected.amount}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Método</dt>
                <dd className="text-neutral-900">{PAYMENT_METHOD_LABELS[panel.selected.paidMethod]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Pagado por</dt>
                <dd className="text-neutral-900">{panel.selected.paidBy?.name ?? panel.selected.paidBy?.username ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Proveedor</dt>
                <dd className="text-neutral-900">{panel.selected.vendor ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Origen</dt>
                <dd className="text-neutral-900">{panel.selected.cashMovement ? "Descontado de caja" : "Independiente"}</dd>
              </div>
            </dl>
            {panel.selected.notes && (
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Notas</p>
                <p className="text-sm text-neutral-900">{panel.selected.notes}</p>
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
