import { useEffect, useState } from "react";
import { Module, UnitType, VolumeUnit, WeightUnit } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { StockSection } from "@/components/inventory/StockSection";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface IngredientItem {
  id: string;
  name: string;
  unitType: UnitType;
  weightUnit: WeightUnit | null;
  volumeUnit: VolumeUnit | null;
  costPerUnit: string | null;
  stock: string;
  minStock: string | null;
}

interface IngredientFormState {
  name: string;
  unitType: UnitType;
  weightUnit: WeightUnit | "";
  volumeUnit: VolumeUnit | "";
  costPerUnit: string;
  minStock: string;
}

function emptyForm(): IngredientFormState {
  return { name: "", unitType: UnitType.UNIT, weightUnit: "", volumeUnit: "", costPerUnit: "", minStock: "" };
}

const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  [WeightUnit.KILOGRAM]: "Kilogramo",
  [WeightUnit.GRAM]: "Gramo",
  [WeightUnit.POUND]: "Libra",
  [WeightUnit.OUNCE]: "Onza",
};

const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  [VolumeUnit.LITER]: "Litro",
  [VolumeUnit.MILLILITER]: "Mililitro",
  [VolumeUnit.GALLON]: "Galón",
  [VolumeUnit.FLUID_OUNCE]: "Onza líquida",
};

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

function unitAbbr(item: IngredientItem): string {
  if (item.unitType === UnitType.WEIGHT && item.weightUnit) return WEIGHT_UNIT_ABBR[item.weightUnit];
  if (item.unitType === UnitType.VOLUME && item.volumeUnit) return VOLUME_UNIT_ABBR[item.volumeUnit];
  return "u.";
}

export const Route = createFileRoute("/_app/inventory/ingredients/")({
  component: () => (
    <ModuleGuard module={Module.INVENTORY}>
      <IngredientsPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<IngredientItem>[] = [
  { accessorKey: "name", header: "Nombre" },
  { id: "stock", header: "Stock", cell: ({ row }) => `${row.original.stock} ${unitAbbr(row.original)}` },
  { id: "minStock", header: "Stock mínimo", cell: ({ row }) => row.original.minStock ?? "—" },
  { id: "cost", header: "Costo/u.", cell: ({ row }) => (row.original.costPerUnit ? `$${row.original.costPerUnit}` : "—") },
];

function IngredientsPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<IngredientItem>();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<IngredientFormState>(emptyForm());

  const { data: ingredients, isLoading } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<IngredientItem[]>>("/ingredients");
      return data.data;
    },
  });

  useEffect(() => {
    if (!panel.selected) return;
    setForm({
      name: panel.selected.name,
      unitType: panel.selected.unitType,
      weightUnit: panel.selected.weightUnit ?? "",
      volumeUnit: panel.selected.volumeUnit ?? "",
      costPerUnit: panel.selected.costPerUnit ?? "",
      minStock: panel.selected.minStock ?? "",
    });
  }, [panel.selected]);

  function toPayload(state: IngredientFormState) {
    return {
      name: state.name,
      unitType: state.unitType,
      weightUnit: state.unitType === UnitType.WEIGHT && state.weightUnit ? state.weightUnit : undefined,
      volumeUnit: state.unitType === UnitType.VOLUME && state.volumeUnit ? state.volumeUnit : undefined,
      costPerUnit: state.costPerUnit ? Number(state.costPerUnit) : undefined,
      minStock: state.minStock ? Number(state.minStock) : undefined,
    };
  }

  const createIngredient = useMutation({
    mutationFn: async () => {
      await apiClient.post("/ingredients", toPayload(form));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      setCreating(false);
      setForm(emptyForm());
    },
  });

  const updateIngredient = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.patch(`/ingredients/${panel.selected.id}`, toPayload(form));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });

  const deleteIngredient = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.delete(`/ingredients/${panel.selected.id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      panel.close();
    },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Ingredientes</h1>
        {!creating && (
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm());
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> Ingrediente
          </Button>
        )}
      </div>

      {creating && (
        <IngredientForm form={form} setForm={setForm}>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createIngredient.mutate()} disabled={!form.name || createIngredient.isPending}>
              Crear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </IngredientForm>
      )}

      <DataTable
        columns={columns}
        data={ingredients ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay ingredientes cargados."
        className="flex-1"
      />

      <SidePanel open={panel.isOpen} onClose={panel.close} title={panel.selected?.name}>
        {panel.selected && (
          <div className="flex flex-col gap-6">
            <IngredientForm form={form} setForm={setForm}>
              <Button size="sm" onClick={() => updateIngredient.mutate()} disabled={updateIngredient.isPending}>
                Guardar cambios
              </Button>
            </IngredientForm>

            <StockSection
              ingredientId={panel.selected.id}
              currentStock={panel.selected.stock}
              invalidateKey={["ingredients"]}
            />

            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteIngredient.mutate()}
              disabled={deleteIngredient.isPending}
              className="w-fit"
            >
              Eliminar ingrediente
            </Button>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

function IngredientForm({
  form,
  setForm,
  children,
}: {
  form: IngredientFormState;
  setForm: React.Dispatch<React.SetStateAction<IngredientFormState>>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ingName">Nombre</Label>
        <Input id="ingName" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ingUnitType">Unidad</Label>
        <select
          id="ingUnitType"
          className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          value={form.unitType}
          onChange={(event) => setForm((prev) => ({ ...prev, unitType: event.target.value as UnitType }))}
        >
          <option value={UnitType.UNIT}>Unidad</option>
          <option value={UnitType.WEIGHT}>Peso</option>
          <option value={UnitType.VOLUME}>Volumen</option>
        </select>
      </div>

      {form.unitType === UnitType.WEIGHT && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ingWeightUnit">Unidad de peso</Label>
          <select
            id="ingWeightUnit"
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            value={form.weightUnit}
            onChange={(event) => setForm((prev) => ({ ...prev, weightUnit: event.target.value as WeightUnit }))}
          >
            <option value="">Elegí una unidad</option>
            {Object.values(WeightUnit).map((unit) => (
              <option key={unit} value={unit}>
                {WEIGHT_UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        </div>
      )}

      {form.unitType === UnitType.VOLUME && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ingVolumeUnit">Unidad de volumen</Label>
          <select
            id="ingVolumeUnit"
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            value={form.volumeUnit}
            onChange={(event) => setForm((prev) => ({ ...prev, volumeUnit: event.target.value as VolumeUnit }))}
          >
            <option value="">Elegí una unidad</option>
            {Object.values(VolumeUnit).map((unit) => (
              <option key={unit} value={unit}>
                {VOLUME_UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="ingCost">Costo por unidad</Label>
          <Input
            id="ingCost"
            type="number"
            min={0}
            value={form.costPerUnit}
            onChange={(event) => setForm((prev) => ({ ...prev, costPerUnit: event.target.value }))}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="ingMinStock">Stock mínimo</Label>
          <Input
            id="ingMinStock"
            type="number"
            min={0}
            value={form.minStock}
            onChange={(event) => setForm((prev) => ({ ...prev, minStock: event.target.value }))}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
