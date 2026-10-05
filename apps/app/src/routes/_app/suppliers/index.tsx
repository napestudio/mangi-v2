import { useState } from "react";
import { Module } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, Plus, Unlink } from "lucide-react";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface SupplierListItem {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  balance: string;
  isActive: boolean;
  ingredients: { ingredient: { id: string; name: string } }[];
}

interface SupplierDetail extends SupplierListItem {
  address: string | null;
  taxId: string | null;
  notes: string | null;
  ledgerEntries: {
    id: string;
    type: "PURCHASE" | "PAYMENT" | "ADJUSTMENT";
    amount: string;
    description: string | null;
    createdAt: string;
    createdBy: { id: string; name: string | null; username: string } | null;
  }[];
}

interface IngredientOption {
  id: string;
  name: string;
}

interface SupplierFormState {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
}

function emptyForm(): SupplierFormState {
  return { name: "", contactName: "", email: "", phone: "", address: "", taxId: "", notes: "" };
}

const LEDGER_LABELS: Record<string, string> = { PURCHASE: "Compra", PAYMENT: "Pago", ADJUSTMENT: "Ajuste" };

export const Route = createFileRoute("/_app/suppliers/")({
  component: () => (
    <ModuleGuard module={Module.SUPPLIERS}>
      <SuppliersPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<SupplierListItem>[] = [
  { accessorKey: "name", header: "Nombre" },
  { id: "contact", header: "Contacto", cell: ({ row }) => row.original.contactName ?? "—" },
  { id: "phone", header: "Teléfono", cell: ({ row }) => row.original.phone ?? "—" },
  {
    id: "balance",
    header: "Saldo",
    cell: ({ row }) => (
      <span className={cn("font-medium", Number(row.original.balance) > 0 ? "text-red-600" : "text-neutral-900")}>
        ${row.original.balance}
      </span>
    ),
  },
];

function SuppliersPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<SupplierListItem>();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SupplierFormState>(emptyForm());
  const [linkIngredientId, setLinkIngredientId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SupplierListItem[]>>("/suppliers");
      return data.data;
    },
  });

  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<IngredientOption[]>>("/ingredients");
      return data.data;
    },
  });

  const { data: detail } = useQuery({
    queryKey: ["supplier", panel.selected?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SupplierDetail>>(`/suppliers/${panel.selected!.id}`);
      return data.data;
    },
    enabled: !!panel.selected,
  });

  const createSupplier = useMutation({
    mutationFn: async () => {
      await apiClient.post("/suppliers", form);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setCreating(false);
      setForm(emptyForm());
    },
  });

  const linkIngredient = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.post(`/suppliers/${panel.selected.id}/ingredients`, { ingredientId: linkIngredientId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["supplier", panel.selected?.id] });
      setLinkIngredientId("");
    },
  });

  const unlinkIngredient = useMutation({
    mutationFn: async (ingredientId: string) => {
      if (!panel.selected) return;
      await apiClient.delete(`/suppliers/${panel.selected.id}/ingredients/${ingredientId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["supplier", panel.selected?.id] });
    },
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.post(`/suppliers/${panel.selected.id}/payments`, {
        amount: Number(paymentAmount),
        description: paymentDescription || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["supplier", panel.selected?.id] });
      setPaymentAmount("");
      setPaymentDescription("");
    },
  });

  const linkedIngredientIds = new Set(detail?.ingredients.map((i) => i.ingredient.id));
  const availableIngredients = ingredients?.filter((ing) => !linkedIngredientIds.has(ing.id));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Proveedores</h1>
        <div className="flex gap-2">
          <Link to="/suppliers/purchase-orders">
            <Button size="sm" variant="outline">
              <ClipboardCheck className="h-4 w-4" /> Órdenes de compra
            </Button>
          </Link>
          {!creating && (
            <Button
              size="sm"
              onClick={() => {
                setForm(emptyForm());
                setCreating(true);
              }}
            >
              <Plus className="h-4 w-4" /> Proveedor
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supName">Nombre</Label>
              <Input id="supName" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supContact">Contacto</Label>
              <Input
                id="supContact"
                value={form.contactName}
                onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supPhone">Teléfono</Label>
              <Input id="supPhone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supEmail">Email</Label>
              <Input id="supEmail" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.name || createSupplier.isPending} onClick={() => createSupplier.mutate()}>
              Crear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={suppliers ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay proveedores cargados."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.name}>
        {detail && (
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Contacto</dt>
                <dd className="text-neutral-900">{detail.contactName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Teléfono</dt>
                <dd className="text-neutral-900">{detail.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Email</dt>
                <dd className="text-neutral-900">{detail.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Saldo</dt>
                <dd className={cn("font-semibold", Number(detail.balance) > 0 ? "text-red-600" : "text-neutral-900")}>
                  ${detail.balance}
                </dd>
              </div>
            </dl>

            <div className="border-t border-neutral-200 pt-4">
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Ingredientes vinculados</p>
              <div className="flex flex-col gap-1">
                {detail.ingredients.length === 0 && <p className="text-sm text-neutral-500">Sin ingredientes vinculados.</p>}
                {detail.ingredients.map((link) => (
                  <div key={link.ingredient.id} className="flex items-center justify-between rounded-md border border-neutral-100 px-2 py-1 text-sm">
                    <span>{link.ingredient.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => unlinkIngredient.mutate(link.ingredient.id)}>
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <select
                  className="h-9 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm"
                  value={linkIngredientId}
                  onChange={(event) => setLinkIngredientId(event.target.value)}
                >
                  <option value="">Vincular ingrediente...</option>
                  {availableIngredients?.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!linkIngredientId || linkIngredient.isPending} onClick={() => linkIngredient.mutate()}>
                  Vincular
                </Button>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4">
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Registrar pago</p>
              <div className="flex flex-col gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Monto"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
                <Input
                  placeholder="Descripción (opcional)"
                  value={paymentDescription}
                  onChange={(event) => setPaymentDescription(event.target.value)}
                />
                <Button size="sm" disabled={!paymentAmount || recordPayment.isPending} onClick={() => recordPayment.mutate()}>
                  Registrar pago
                </Button>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4">
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Movimientos</p>
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                {detail.ledgerEntries.length === 0 && <p className="text-neutral-500">Sin movimientos todavía.</p>}
                {detail.ledgerEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between border-b border-neutral-100 py-1">
                    <div>
                      <p className="text-neutral-900">
                        {LEDGER_LABELS[entry.type]} {entry.description ? `· ${entry.description}` : ""}
                      </p>
                      <p className="text-xs text-neutral-500">{new Date(entry.createdAt).toLocaleDateString("es-AR")}</p>
                    </div>
                    <span className={cn("font-medium", entry.type === "PAYMENT" ? "text-emerald-600" : "text-neutral-900")}>
                      {entry.type === "PAYMENT" ? "-" : "+"}${entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
