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
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";

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
}

interface ExpenseFormState {
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: string;
  paidMethod: PaymentMethodExtended;
  paidById: string | undefined;
  notes: string;
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

function emptyForm(): ExpenseFormState {
  return {
    category: ExpenseCategory.OTHER,
    description: "",
    vendor: "",
    amount: "",
    paidMethod: PaymentMethodExtended.CASH,
    paidById: undefined,
    notes: "",
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
  { id: "amount", header: "Monto", cell: ({ row }) => formatPrice(row.original.amount) },
];

function ExpensesPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<ExpenseListItem>();

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm());

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ExpenseListItem[]>>("/expenses");
      return data.data;
    },
  });

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
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      closePanel();
    },
  });

  function openCreate() {
    panel.close();
    setForm(emptyForm());
    setIsCreating(true);
  }

  function closePanel() {
    panel.close();
    setIsCreating(false);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Gastos</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Gasto
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={expenses ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay gastos cargados."
        className="flex-1"
      />

      <SidePanel
        open={panel.isOpen || isCreating}
        onClose={closePanel}
        title={isCreating ? "Nuevo gasto" : panel.selected?.description}
      >
        {isCreating && (
          <div className="flex flex-col gap-3">
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
              <Button size="sm" variant="ghost" onClick={closePanel}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!isCreating && panel.selected && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Categoría</dt>
                <dd className="text-neutral-900">{CATEGORY_LABELS[panel.selected.category]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Monto</dt>
                <dd className="font-semibold text-neutral-900">{formatPrice(panel.selected.amount)}</dd>
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
