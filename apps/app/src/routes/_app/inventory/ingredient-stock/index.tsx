import { UnitType, VolumeUnit, WeightUnit } from "@mangiar/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { StockSection } from "@/components/inventory/StockSection";
import { DataTable } from "@/components/ui/data-table";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";

interface IngredientStockItem {
  id: string;
  name: string;
  stock: string;
  minStock: string | null;
  costPerUnit: string | null;
  unitType: UnitType;
  weightUnit: WeightUnit | null;
  volumeUnit: VolumeUnit | null;
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

function unitAbbr(item: IngredientStockItem): string {
  if (item.unitType === UnitType.WEIGHT && item.weightUnit) return WEIGHT_UNIT_ABBR[item.weightUnit];
  if (item.unitType === UnitType.VOLUME && item.volumeUnit) return VOLUME_UNIT_ABBR[item.volumeUnit];
  return "u.";
}

const columns: ColumnDef<IngredientStockItem>[] = [
  { accessorKey: "name", header: "Nombre" },
  { id: "stock", header: "Stock", cell: ({ row }) => `${row.original.stock} ${unitAbbr(row.original)}` },
  { id: "minStock", header: "Alerta stock", cell: ({ row }) => row.original.minStock ?? "—" },
  { id: "cost", header: "Costo/u.", cell: ({ row }) => (row.original.costPerUnit ? formatPrice(row.original.costPerUnit) : "—") },
];

export const Route = createFileRoute("/_app/inventory/ingredient-stock/")({
  component: IngredientStockPage,
});

function IngredientStockPage() {
  // Guarda solo el id, no una copia de la fila — mismo patrón que inventory/stock/index.tsx.
  const panel = useSidePanel<string>();

  const { data: ingredients, isLoading } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<IngredientStockItem[]>>("/ingredients");
      return data.data;
    },
  });

  const selectedIngredient = ingredients?.find((ingredient) => ingredient.id === panel.selected);

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Stock de ingredientes</h1>

      <DataTable
        columns={columns}
        data={ingredients ?? []}
        isLoading={isLoading}
        onRowClick={(row) => panel.open(row.id)}
        emptyMessage="No hay ingredientes cargados."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={selectedIngredient?.name}>
        {selectedIngredient && (
          <StockSection
            ingredientId={selectedIngredient.id}
            currentStock={selectedIngredient.stock}
            invalidateKey={["ingredients"]}
          />
        )}
      </SidePanel>
    </div>
  );
}
