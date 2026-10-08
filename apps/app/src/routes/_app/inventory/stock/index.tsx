import { UnitType, VolumeUnit, WeightUnit, type PriceType } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { StockSection } from "@/components/inventory/StockSection";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface StockProductItem {
  id: string;
  name: string;
  trackStock: boolean;
  stock: string;
  minStock: string | null;
  unitType: UnitType;
  weightUnit: WeightUnit | null;
  volumeUnit: VolumeUnit | null;
  category: { id: string; name: string } | null;
  prices: { type: PriceType; price: string }[];
}

const WEIGHT_UNIT_ABBR: Record<WeightUnit, string> = {
  [WeightUnit.KILOGRAM]: "kg",
  [WeightUnit.GRAM]: "g",
  [WeightUnit.POUND]: "lb",
  [WeightUnit.OUNCE]: "oz",
};

const VOLUME_UNIT_ABBR: Record<VolumeUnit, string> = {
  [VolumeUnit.LITER]: "L",
  [VolumeUnit.MILLILITER]: "mL",
  [VolumeUnit.GALLON]: "gal",
  [VolumeUnit.FLUID_OUNCE]: "oz líq.",
};

function unitAbbr(item: StockProductItem): string {
  if (item.unitType === UnitType.WEIGHT && item.weightUnit) return WEIGHT_UNIT_ABBR[item.weightUnit];
  if (item.unitType === UnitType.VOLUME && item.volumeUnit) return VOLUME_UNIT_ABBR[item.volumeUnit];
  return "u.";
}

const columns: ColumnDef<StockProductItem>[] = [
  {
    id: "name",
    header: "Producto",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {!row.original.trackStock && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            Siempre disponible
          </span>
        )}
      </div>
    ),
  },
  {
    id: "category",
    header: "Categoría",
    cell: ({ row }) => row.original.category?.name ?? "Sin categoría",
  },
  {
    id: "stock",
    header: "Stock actual",
    cell: ({ row }) => {
      const product = row.original;
      if (!product.trackStock) return <span className="text-green-700">N/A</span>;
      const stockValue = Number(product.stock);
      return (
        <span className={cn("font-medium", stockValue <= 0 ? "text-red-600" : "text-neutral-900")}>
          {product.stock} {unitAbbr(product)}
        </span>
      );
    },
  },
  {
    id: "minStock",
    header: "Alerta stock",
    cell: ({ row }) => row.original.minStock ?? "—",
  },
  {
    id: "price",
    header: "Precio",
    cell: ({ row }) => (row.original.prices[0] ? formatPrice(row.original.prices[0].price) : "Sin precio"),
  },
];

export const Route = createFileRoute("/_app/inventory/stock/")({
  component: StockPage,
});

function StockPage() {
  const queryClient = useQueryClient();
  // Guarda solo el id, no una copia de la fila — así, después de activar el seguimiento de
  // stock o ajustar una cantidad (que invalidan ["products"]), el panel ve el dato fresco
  // en el próximo render sin tener que empujarlo a mano.
  const panel = useSidePanel<string>();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<StockProductItem[]>>("/products");
      return data.data;
    },
  });

  const selectedProduct = products?.find((product) => product.id === panel.selected);

  const activateTracking = useMutation({
    mutationFn: async (productId: string) => {
      await apiClient.patch(`/products/${productId}`, { trackStock: true, unitType: UnitType.UNIT });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Stock de productos</h1>

      <DataTable
        columns={columns}
        data={products ?? []}
        isLoading={isLoading}
        onRowClick={(row) => panel.open(row.id)}
        emptyMessage="No hay productos cargados."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={selectedProduct?.name}>
        {selectedProduct &&
          (selectedProduct.trackStock ? (
            <StockSection
              productId={selectedProduct.id}
              currentStock={selectedProduct.stock}
              invalidateKey={["products"]}
            />
          ) : (
            <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
              <p className="text-sm text-neutral-600">Este producto no tiene control de stock activado.</p>
              <Button
                size="sm"
                className="w-fit"
                onClick={() => activateTracking.mutate(selectedProduct.id)}
                disabled={activateTracking.isPending}
              >
                Activar seguimiento
              </Button>
            </div>
          ))}
      </SidePanel>
    </div>
  );
}
