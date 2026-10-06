import { Module, OrderStatus, OrderType } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { OrderDetailPanel } from "@/components/salon/OrderDetailPanel";
import type { OrderView } from "@/components/salon/types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "@/lib/labels";

interface OrderInvoiceRef {
  id: string;
  status: "PENDING" | "EMITTED" | "CANCELLED" | "FAILED";
}

interface OrderListItem extends OrderView {
  needsInvoice: boolean;
  invoices: OrderInvoiceRef[];
  table: { id: string; number: string } | null;
}

const ACTIVE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.IN_PROGRESS];

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersPage,
});

const columns: ColumnDef<OrderListItem>[] = [
  { id: "code", header: "Código", cell: ({ row }) => row.original.code },
  { id: "type", header: "Tipo", cell: ({ row }) => ORDER_TYPE_LABELS[row.original.type] },
  {
    id: "createdAt",
    header: "Fecha",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    id: "total",
    header: "Total",
    cell: ({ row }) => formatCurrency(Number(row.original.total)),
  },
  { id: "status", header: "Estado", cell: ({ row }) => ORDER_STATUS_LABELS[row.original.status] },
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
  const isActive = panel.selected ? ACTIVE_STATUSES.includes(panel.selected.status) : false;

  function handleOrderUpdated(updated: OrderView) {
    if (!panel.selected) return;
    panel.open({ ...panel.selected, ...updated });
  }

  function refreshAndClosePanel() {
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    panel.close();
  }

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

      <SidePanel
        open={panel.isOpen}
        onClose={panel.close}
        title={panel.selected ? `Pedido ${panel.selected.code} · ${ORDER_TYPE_LABELS[panel.selected.type]}` : ""}
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        {panel.selected && (
          <div className="flex h-full min-h-0 flex-col gap-6 px-6 py-4">
            <dl className="grid shrink-0 grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Fecha</dt>
                <dd className="text-neutral-900">{new Date(panel.selected.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Estado</dt>
                <dd className="text-neutral-900">{ORDER_STATUS_LABELS[panel.selected.status]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Tipo</dt>
                <dd className="text-neutral-900">{ORDER_TYPE_LABELS[panel.selected.type]}</dd>
              </div>
              {panel.selected.type === OrderType.DINE_IN && (
                <div>
                  <dt className="text-xs font-medium uppercase text-neutral-500">Mesa</dt>
                  <dd className="text-neutral-900">
                    {panel.selected.table ? `Mesa ${panel.selected.table.number}` : "Sin asignar"}
                  </dd>
                </div>
              )}
            </dl>

            {isActive ? (
              <OrderDetailPanel
                order={panel.selected}
                onOrderUpdated={handleOrderUpdated}
                onOrderClosed={refreshAndClosePanel}
                onOrderRemoved={refreshAndClosePanel}
                onOrderMoved={refreshAndClosePanel}
                className="flex-1 min-h-0"
              />
            ) : (
              <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto border-t border-neutral-200 pt-3">
                {panel.selected.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
                        <span className="shrink-0 text-xs font-medium text-neutral-500">x{item.quantity}</span>
                      </div>
                      {item.notes && <p className="text-xs italic text-neutral-500">Nota: {item.notes}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-medium text-neutral-900">
                      {formatCurrency(Number(item.totalPrice))}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
                  <span className="text-sm font-semibold text-neutral-900">Total:</span>
                  <span className="text-lg font-semibold text-neutral-900">{formatCurrency(Number(panel.selected.total))}</span>
                </div>
              </div>
            )}

            {hasModule(Module.FISCAL) && panel.selected.needsInvoice && (
              <div className="shrink-0">
                <p className="mb-1 text-xs font-medium uppercase text-neutral-500">Facturación</p>
                {hasActiveInvoice ? (
                  <p className="text-sm text-neutral-900">Ya facturado</p>
                ) : (
                  <Button
                    size="sm"
                    disabled={!canInvoice || issueInvoice.isPending}
                    onClick={() => issueInvoice.mutate()}
                  >
                    Facturar
                  </Button>
                )}
                {issueInvoice.isError && <p className="mt-1 text-xs text-red-600">No se pudo facturar el pedido.</p>}
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
