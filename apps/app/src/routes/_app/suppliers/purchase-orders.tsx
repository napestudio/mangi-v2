import { useState } from "react";
import { Module, PurchaseOrderStatus } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface SupplierOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
}

interface IngredientOption {
  id: string;
  name: string;
}

interface PurchaseOrderItem {
  id: string;
  productId: string | null;
  ingredientId: string | null;
  description: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  product: { name: string } | null;
  ingredient: { name: string } | null;
}

interface PurchaseOrderItem2 {
  productId?: string;
  ingredientId?: string;
  description?: string;
  quantity: string;
  unitCost: string;
}

interface PurchaseOrderListItem {
  id: string;
  status: PurchaseOrderStatus;
  totalCost: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  items: PurchaseOrderItem[];
}

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.DRAFT]: "Borrador",
  [PurchaseOrderStatus.ORDERED]: "Pedida",
  [PurchaseOrderStatus.RECEIVED]: "Recibida",
  [PurchaseOrderStatus.CANCELLED]: "Cancelada",
};

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.DRAFT]: "bg-neutral-200 text-neutral-700",
  [PurchaseOrderStatus.ORDERED]: "bg-sky-100 text-sky-800",
  [PurchaseOrderStatus.RECEIVED]: "bg-emerald-100 text-emerald-800",
  [PurchaseOrderStatus.CANCELLED]: "bg-red-100 text-red-700",
};

export const Route = createFileRoute("/_app/suppliers/purchase-orders")({
  component: () => (
    <ModuleGuard module={Module.SUPPLIERS}>
      <PurchaseOrdersPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<PurchaseOrderListItem>[] = [
  { id: "supplier", header: "Proveedor", cell: ({ row }) => row.original.supplier.name },
  {
    id: "status",
    header: "Estado",
    cell: ({ row }) => (
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[row.original.status])}>
        {STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
  { id: "total", header: "Total", cell: ({ row }) => (row.original.totalCost ? `$${row.original.totalCost}` : "—") },
  { id: "date", header: "Fecha", cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("es-AR") },
];

function emptyItem(): PurchaseOrderItem2 {
  return { quantity: "1", unitCost: "0" };
}

function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<PurchaseOrderListItem>();

  const [creating, setCreating] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PurchaseOrderItem2[]>([emptyItem()]);

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<PurchaseOrderListItem[]>>("/purchase-orders");
      return data.data;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SupplierOption[]>>("/suppliers");
      return data.data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ProductOption[]>>("/products");
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

  const createPO = useMutation({
    mutationFn: async () => {
      await apiClient.post("/purchase-orders", {
        supplierId,
        items: items.map((item) => ({
          productId: item.productId || undefined,
          ingredientId: item.ingredientId || undefined,
          description: item.description || undefined,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
        })),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setCreating(false);
      setSupplierId("");
      setItems([emptyItem()]);
    },
  });

  const markReceived = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.patch(`/purchase-orders/${panel.selected.id}/status`, { status: PurchaseOrderStatus.RECEIVED });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      panel.close();
    },
  });

  function updateItem(index: number, patch: Partial<PurchaseOrderItem2>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Órdenes de compra</h1>
        {!creating && (
          <Button
            size="sm"
            onClick={() => {
              setSupplierId("");
              setItems([emptyItem()]);
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> Orden de compra
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="poSupplier">Proveedor</Label>
            <select
              id="poSupplier"
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Seleccioná un proveedor</option>
              {suppliers?.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <Label>Items</Label>
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                className="h-9 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm"
                value={item.productId ?? item.ingredientId ?? ""}
                onChange={(event) => {
                  const [kind, id] = event.target.value.split(":");
                  updateItem(index, {
                    productId: kind === "product" ? id : undefined,
                    ingredientId: kind === "ingredient" ? id : undefined,
                  });
                }}
              >
                <option value="">Sin producto/ingrediente (texto libre)</option>
                <optgroup label="Productos">
                  {products?.map((p) => (
                    <option key={p.id} value={`product:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ingredientes">
                  {ingredients?.map((i) => (
                    <option key={i.id} value={`ingredient:${i.id}`}>
                      {i.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {!item.productId && !item.ingredientId && (
                <Input
                  className="w-40"
                  placeholder="Descripción"
                  value={item.description ?? ""}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                />
              )}
              <Input
                type="number"
                min={0}
                className="w-20"
                placeholder="Cant."
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: event.target.value })}
              />
              <Input
                type="number"
                min={0}
                className="w-24"
                placeholder="Costo/u."
                value={item.unitCost}
                onChange={(event) => updateItem(index, { unitCost: event.target.value })}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}>
                Quitar
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            Agregar item
          </Button>

          <p className="text-sm font-medium text-neutral-700">Total: ${total.toFixed(2)}</p>

          <div className="flex gap-2">
            <Button size="sm" disabled={!supplierId || items.length === 0 || createPO.isPending} onClick={() => createPO.mutate()}>
              Crear orden
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={purchaseOrders ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay órdenes de compra todavía."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected ? `Orden · ${panel.selected.supplier.name}` : ""}>
        {panel.selected && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-medium uppercase text-neutral-500">Estado</p>
              <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[panel.selected.status])}>
                {STATUS_LABELS[panel.selected.status]}
              </span>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Items</p>
              <div className="flex flex-col gap-1 text-sm">
                {panel.selected.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-neutral-100 py-1">
                    <span>{item.product?.name ?? item.ingredient?.name ?? item.description ?? "—"}</span>
                    <span className="text-neutral-500">
                      {item.quantity} × ${item.unitCost} = ${item.totalCost}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm font-semibold text-neutral-900">Total: ${panel.selected.totalCost ?? "0"}</p>

            {panel.selected.status !== "RECEIVED" && panel.selected.status !== "CANCELLED" && (
              <Button size="sm" onClick={() => markReceived.mutate()} disabled={markReceived.isPending}>
                Marcar como recibida
              </Button>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
