import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<OrderListItem[]>>("/orders");
      return data.data;
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Pedidos</h1>
        <Link to="/orders/new">
          <Button>Nuevo pedido</Button>
        </Link>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Cargando...</p>}
      <div className="flex flex-col gap-2">
        {data?.map((order) => (
          <Card key={order.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">{order.type}</p>
                <p className="text-xs text-neutral-500">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">${order.total}</p>
                <p className="text-xs text-neutral-500">{order.status}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {data && data.length === 0 && <p className="text-sm text-neutral-500">No hay pedidos todavía.</p>}
      </div>
    </div>
  );
}
