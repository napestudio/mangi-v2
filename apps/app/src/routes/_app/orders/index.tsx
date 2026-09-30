import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface OrderListItem {
  id: string;
  type: string;
  status: string;
  total: string;
  createdAt: string;
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
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<OrderListItem[]>>("/orders");
      return data.data;
    },
  });

  const panel = useSidePanel<OrderListItem>();

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
          </dl>
        )}
      </SidePanel>
    </div>
  );
}
