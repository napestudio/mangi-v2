import { Module } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface OrderInvoiceRef {
  id: string;
  status: "PENDING" | "EMITTED" | "CANCELLED" | "FAILED";
}

interface OrderItemRef {
  id: string;
  name: string;
  quantity: number;
  sentToKitchen: boolean;
}

interface OrderListItem {
  id: string;
  type: string;
  status: string;
  total: string;
  needsInvoice: boolean;
  createdAt: string;
  invoices: OrderInvoiceRef[];
  items: OrderItemRef[];
}

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersPage,
});

const columns: ColumnDef<OrderListItem>[] = [
  { accessorKey: "type", header: "Tipo" },
  {
    id: "createdAt",
    header: "Fecha",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    id: "total",
    header: "Total",
    cell: ({ row }) => `$${row.original.total}`,
  },
  { accessorKey: "status", header: "Estado" },
];

function OrdersPage() {
  const queryClient = useQueryClient();
  const { hasModule } = useModules();

  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<OrderListItem[]>>("/orders");
      return data.data;
    },
  });

  const panel = useSidePanel<OrderListItem>();

  const issueInvoice = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.post(`/orders/${panel.selected.id}/invoice`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      panel.close();
    },
  });

  const hasActiveInvoice = panel.selected?.invoices.some((invoice) => invoice.status === "EMITTED" || invoice.status === "PENDING");
  const canInvoice = hasModule(Module.FISCAL) && panel.selected?.needsInvoice && panel.selected.status === "COMPLETED" && !hasActiveInvoice;

  const pendingKitchenItems = panel.selected?.items.filter((item) => !item.sentToKitchen) ?? [];

  const sendToKitchen = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.patch(`/orders/${panel.selected.id}/send-to-kitchen`, {
        itemIds: pendingKitchenItems.map((item) => item.id),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Pedidos</h1>
        <Link to="/orders/new">
          <Button>Nuevo pedido</Button>
        </Link>
      </div>
      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay pedidos todavía."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected ? `Pedido ${panel.selected.type}` : ""}>
        {panel.selected && (
          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Fecha</dt>
              <dd className="text-neutral-900">{new Date(panel.selected.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Estado</dt>
              <dd className="text-neutral-900">{panel.selected.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Total</dt>
              <dd className="text-neutral-900">${panel.selected.total}</dd>
            </div>

            {hasModule(Module.PRINTING) && panel.selected.items.length > 0 && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Cocina</dt>
                {pendingKitchenItems.length === 0 ? (
                  <dd className="text-neutral-900">Todos los items ya se enviaron</dd>
                ) : (
                  <Button size="sm" className="mt-1" disabled={sendToKitchen.isPending} onClick={() => sendToKitchen.mutate()}>
                    Enviar a cocina ({pendingKitchenItems.length})
                  </Button>
                )}
                {sendToKitchen.isError && <p className="mt-1 text-xs text-red-600">No se pudo enviar a cocina.</p>}
              </div>
            )}

            {hasModule(Module.FISCAL) && panel.selected.needsInvoice && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Facturación</dt>
                {hasActiveInvoice ? (
                  <dd className="text-neutral-900">Ya facturado</dd>
                ) : (
                  <Button
                    size="sm"
                    className="mt-1"
                    disabled={!canInvoice || issueInvoice.isPending}
                    onClick={() => issueInvoice.mutate()}
                  >
                    Facturar
                  </Button>
                )}
                {issueInvoice.isError && <p className="mt-1 text-xs text-red-600">No se pudo facturar el pedido.</p>}
              </div>
            )}
          </dl>
        )}
      </SidePanel>
    </div>
  );
}
