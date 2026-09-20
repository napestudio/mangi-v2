import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface ProductListItem {
  id: string;
  name: string;
  isActive: boolean;
  prices: { type: string; price: string }[];
  category: { name: string } | null;
}

export const Route = createFileRoute("/_app/menu/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ProductListItem[]>>("/products");
      return data.data;
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
      {isLoading && <p className="text-sm text-neutral-500">Cargando...</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((product) => (
          <Card key={product.id}>
            <CardContent className="flex flex-col gap-1 p-4">
              <p className="text-sm font-medium text-neutral-900">{product.name}</p>
              <p className="text-xs text-neutral-500">{product.category?.name ?? "Sin categoría"}</p>
              <p className="text-sm font-semibold">
                {product.prices[0] ? `$${product.prices[0].price}` : "Sin precio"}
              </p>
            </CardContent>
          </Card>
        ))}
        {data && data.length === 0 && <p className="text-sm text-neutral-500">No hay productos todavía.</p>}
      </div>
    </div>
  );
}
