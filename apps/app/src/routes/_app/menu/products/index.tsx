import { useMemo } from "react";
import { Module } from "@mangiar/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { StockSection } from "@/components/inventory/StockSection";
import { DataTable } from "@/components/ui/data-table";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";

interface ProductListItem {
  id: string;
  name: string;
  isActive: boolean;
  trackStock: boolean;
  stock: string;
  prices: { type: string; price: string }[];
  category: { name: string } | null;
}

export const Route = createFileRoute("/_app/menu/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { hasModule } = useModules();
  const inventoryActive = hasModule(Module.INVENTORY);

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ProductListItem[]>>("/products");
      return data.data;
    },
  });

  const panel = useSidePanel<ProductListItem>();

  const columns = useMemo<ColumnDef<ProductListItem>[]>(() => {
    const base: ColumnDef<ProductListItem>[] = [
      { accessorKey: "name", header: "Nombre" },
      {
        id: "category",
        header: "Categoría",
        cell: ({ row }) => row.original.category?.name ?? "Sin categoría",
      },
      {
        id: "price",
        header: "Precio",
        cell: ({ row }) => (row.original.prices[0] ? formatPrice(row.original.prices[0].price) : "Sin precio"),
      },
      {
        id: "status",
        header: "Estado",
        cell: ({ row }) => (row.original.isActive ? "Activo" : "Inactivo"),
      },
    ];
    if (inventoryActive) {
      base.push({
        id: "stock",
        header: "Stock",
        cell: ({ row }) => (row.original.trackStock ? row.original.stock : "—"),
      });
    }
    return base;
  }, [inventoryActive]);

  return (
    <div className="flex h-full flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay productos todavía."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.name}>
        {panel.selected && (
          <div className="flex flex-col gap-6">
            <dl className="flex flex-col gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Categoría</dt>
                <dd className="text-neutral-900">{panel.selected.category?.name ?? "Sin categoría"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Estado</dt>
                <dd className="text-neutral-900">{panel.selected.isActive ? "Activo" : "Inactivo"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Precios</dt>
                <dd className="flex flex-col gap-1">
                  {panel.selected.prices.map((price) => (
                    <span key={price.type} className="text-neutral-900">
                      {price.type}: {formatPrice(price.price)}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>

            {inventoryActive && panel.selected.trackStock && (
              <StockSection productId={panel.selected.id} currentStock={panel.selected.stock} invalidateKey={["products"]} />
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
