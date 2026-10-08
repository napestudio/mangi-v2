import { useMemo, useState } from "react";
import { Module, PriceType, ProductTag, UnitType, VolumeUnit, WeightUnit } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { isAxiosError } from "axios";
import { FolderOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast";
import { Wizard, type WizardStep } from "@/components/ui/wizard";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { PRICE_TYPE_LABELS, PRODUCT_TAG_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface ProductComponentItem {
  componentId: string;
  quantity: string;
  component: { id: string; name: string; trackStock: boolean; stock: string; isCombo: boolean };
}

interface ProductListItem {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  categoryId: string | null;
  unitType: UnitType;
  weightUnit: WeightUnit | null;
  volumeUnit: VolumeUnit | null;
  isActive: boolean;
  isCombo: boolean;
  trackStock: boolean;
  stock: string;
  minStock: string | null;
  maxStock: string | null;
  tags: ProductTag[];
  prices: { type: PriceType; price: string }[];
  category: { id: string; name: string } | null;
  comboComponents: ProductComponentItem[];
}

interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface CategoryFormState {
  name: string;
  description: string;
}

function emptyCategoryForm(): CategoryFormState {
  return { name: "", description: "" };
}

interface ComponentRow {
  tempId: string;
  componentId: string;
  quantity: string;
}

interface ProductFormState {
  name: string;
  description: string;
  image: string;
  categoryId: string;
  unitType: UnitType;
  weightUnit: WeightUnit | "";
  volumeUnit: VolumeUnit | "";
  isActive: boolean;
  isCombo: boolean;
  trackStock: boolean;
  initialStock: string;
  minStock: string;
  maxStock: string;
  tags: ProductTag[];
  isFree: boolean;
  differentiatedPrices: boolean;
  prices: Record<PriceType, string>;
  components: ComponentRow[];
}

function emptyForm(): ProductFormState {
  return {
    name: "",
    description: "",
    image: "",
    categoryId: "",
    unitType: UnitType.UNIT,
    weightUnit: "",
    volumeUnit: "",
    isActive: true,
    isCombo: false,
    trackStock: false,
    initialStock: "",
    minStock: "",
    maxStock: "",
    tags: [],
    isFree: false,
    differentiatedPrices: false,
    prices: { [PriceType.DINE_IN]: "", [PriceType.TAKE_AWAY]: "", [PriceType.DELIVERY]: "" },
    components: [],
  };
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

function toPayload(state: ProductFormState) {
  const basePrice = state.prices[PriceType.DINE_IN];
  const prices = state.differentiatedPrices
    ? Object.entries(state.prices)
        .filter(([, price]) => price !== "")
        .map(([type, price]) => ({ type: type as PriceType, price: Number(price) }))
    : basePrice !== ""
      ? Object.values(PriceType).map((type) => ({ type, price: Number(basePrice) }))
      : [];

  return {
    name: state.name,
    description: state.description || undefined,
    image: state.image || undefined,
    categoryId: state.categoryId || undefined,
    unitType: state.unitType,
    weightUnit: state.unitType === UnitType.WEIGHT && state.weightUnit ? state.weightUnit : undefined,
    volumeUnit: state.unitType === UnitType.VOLUME && state.volumeUnit ? state.volumeUnit : undefined,
    isActive: state.isActive,
    isCombo: state.isCombo,
    trackStock: state.trackStock,
    minStock: state.minStock ? Number(state.minStock) : undefined,
    maxStock: state.maxStock ? Number(state.maxStock) : undefined,
    tags: state.tags,
    prices,
    components: state.isCombo
      ? state.components
          .filter((component) => component.componentId)
          .map((component) => ({ componentId: component.componentId, quantity: Number(component.quantity) || 1 }))
      : [],
  };
}

/** Solo para el alta: además de `toPayload()`, manda el stock inicial (si se cargó y se activó
 * "Controlar stock") — editar un producto existente sigue usando exclusivamente `StockSection`
 * (vía `StockService`, con su propio registro de auditoría), nunca este campo. */
function toCreatePayload(state: ProductFormState, isActive: boolean) {
  return {
    ...toPayload({ ...state, isActive }),
    stock: state.trackStock && state.initialStock !== "" ? Number(state.initialStock) : undefined,
  };
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

export const Route = createFileRoute("/_app/menu/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { hasModule } = useModules();
  const inventoryActive = hasModule(Module.INVENTORY);
  const queryClient = useQueryClient();
  const toast = useToast();
  // Guarda solo el id, no una copia congelada de la fila — `selectedProduct` abajo siempre la
  // deriva de la lista recién fetcheada, así que un guardado/ajuste de stock se ve al instante en
  // la vista de info sin tener que refrescar `panel.selected` a mano desde cada mutación.
  const panel = useSidePanel<string>();

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<ProductFormState>(emptyForm());
  const [panelMode, setPanelMode] = useState<"info" | "edit">("info");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm());

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ProductListItem[]>>("/products");
      return data.data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CategoryItem[]>>("/categories");
      return data.data;
    },
  });

  const selectedProduct = products?.find((product) => product.id === panel.selected) ?? null;

  function syncFormFromProduct(selected: ProductListItem) {
    const dineIn = selected.prices.find((price) => price.type === PriceType.DINE_IN)?.price ?? "";
    const takeAway = selected.prices.find((price) => price.type === PriceType.TAKE_AWAY)?.price ?? "";
    const delivery = selected.prices.find((price) => price.type === PriceType.DELIVERY)?.price ?? "";
    const allSame = selected.prices.length === 3 && dineIn === takeAway && takeAway === delivery;
    const isFree = selected.prices.length > 0 && selected.prices.every((price) => Number(price.price) === 0);
    setForm({
      name: selected.name,
      description: selected.description ?? "",
      image: selected.image ?? "",
      categoryId: selected.categoryId ?? "",
      unitType: selected.unitType,
      weightUnit: selected.weightUnit ?? "",
      volumeUnit: selected.volumeUnit ?? "",
      isActive: selected.isActive,
      isCombo: selected.isCombo,
      trackStock: selected.trackStock,
      initialStock: "",
      minStock: selected.minStock ?? "",
      maxStock: selected.maxStock ?? "",
      tags: selected.tags,
      isFree,
      differentiatedPrices: isFree ? false : !allSame,
      prices: { [PriceType.DINE_IN]: dineIn, [PriceType.TAKE_AWAY]: takeAway, [PriceType.DELIVERY]: delivery },
      components: selected.comboComponents.map((component) => ({
        tempId: crypto.randomUUID(),
        componentId: component.componentId,
        quantity: component.quantity,
      })),
    });
  }

  const componentOptions = useMemo(() => {
    if (!products) return [];
    const currentId = panel.selected;
    return products.filter((product) => !product.isCombo && product.id !== currentId).map((product) => ({ id: product.id, name: product.name }));
  }, [products, panel.selected]);

  const createProduct = useMutation({
    mutationFn: async (isActive: boolean) => {
      await apiClient.post("/products", toCreatePayload(form, isActive));
    },
    onSuccess: (_data, isActive) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsCreating(false);
      setForm(emptyForm());
      toast.show({
        message: isActive ? "Producto creado y publicado." : "Producto guardado como borrador.",
        variant: "success",
      });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.patch(`/products/${panel.selected}`, toPayload(form));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      setPanelMode("info");
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async () => {
      if (!panel.selected) return;
      await apiClient.delete(`/products/${panel.selected}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      closePanel();
      toast.show({ message: "Producto eliminado correctamente.", variant: "success" });
    },
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      await apiClient.post("/categories", {
        name: categoryForm.name,
        description: categoryForm.description || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryForm(emptyCategoryForm());
      toast.show({ message: "Categoría creada correctamente.", variant: "success" });
    },
  });

  function openCreate() {
    closePanel();
    setShowCategories(false);
    setForm(emptyForm());
    setIsCreating(true);
  }

  function closePanel() {
    panel.close();
    setIsCreating(false);
    setPanelMode("info");
    setConfirmingDelete(false);
    deleteProduct.reset();
  }

  function openExisting(row: ProductListItem) {
    setIsCreating(false);
    setShowCategories(false);
    setPanelMode("info");
    setConfirmingDelete(false);
    deleteProduct.reset();
    panel.open(row.id);
  }

  function openCategories() {
    closePanel();
    setCategoryForm(emptyCategoryForm());
    setShowCategories(true);
  }

  function openEdit() {
    if (!selectedProduct) return;
    syncFormFromProduct(selectedProduct);
    setPanelMode("edit");
  }

  const basicValid = form.name.trim() !== "";
  const hasAtLeastOnePrice = form.differentiatedPrices
    ? Object.values(form.prices).some((price) => price !== "")
    : form.prices[PriceType.DINE_IN] !== "";
  const componentsValid = !form.isCombo || (form.components.length > 0 && form.components.every((component) => component.componentId));
  const isFormValid = basicValid && hasAtLeastOnePrice && componentsValid;

  const wizardSteps: WizardStep[] = [
    {
      id: "basic",
      label: "Datos básicos",
      isValid: basicValid,
      content: <ProductBasicFields form={form} setForm={setForm} categories={categories ?? []} showActiveToggle={false} />,
    },
    {
      id: "image",
      label: "Imagen",
      optional: true,
      content: <ProductImageField form={form} setForm={setForm} />,
    },
    {
      id: "combo",
      label: "Tipo de producto",
      isValid: componentsValid,
      content: <ProductComboFields form={form} setForm={setForm} componentOptions={componentOptions} />,
    },
    {
      id: "pricing",
      label: "Precios y stock",
      isValid: hasAtLeastOnePrice,
      content: (
        <>
          <ProductPricingFields form={form} setForm={setForm} />
          {inventoryActive && <ProductStockSettings form={form} setForm={setForm} showInitialStock />}
        </>
      ),
    },
    {
      id: "tags",
      label: "Etiquetas",
      optional: true,
      content: (
        <>
          <ProductTagsFields form={form} setForm={setForm} />
          <p className="text-xs text-neutral-500">Las etiquetas son opcionales.</p>
          {createProduct.isError && <p className="text-sm text-red-600">No se pudo guardar el producto.</p>}
        </>
      ),
      footer: (
        <>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={!isFormValid || createProduct.isPending}
            onClick={() => createProduct.mutate(false)}
          >
            Guardar borrador
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!isFormValid || createProduct.isPending}
            onClick={() => createProduct.mutate(true)}
          >
            Guardar y publicar
          </Button>
        </>
      ),
    },
  ];

  const columns = useMemo<ColumnDef<ProductListItem>[]>(() => {
    const base: ColumnDef<ProductListItem>[] = [
      {
        id: "name",
        header: "Nombre",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            {row.original.name}
            {row.original.isCombo && (
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-600">
                Combo
              </span>
            )}
            {!row.original.isActive && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                Borrador
              </span>
            )}
          </span>
        ),
      },
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openCategories}>
            <FolderOpen className="h-4 w-4" /> Categorías
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Producto
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={products ?? []}
        isLoading={isLoading}
        onRowClick={openExisting}
        emptyMessage="No hay productos todavía."
        className="flex-1"
      />

      <SidePanel
        open={panel.isOpen || isCreating}
        onClose={closePanel}
        title={isCreating ? "Nuevo producto" : selectedProduct?.name}
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        {isCreating ? (
          <Wizard steps={wizardSteps} onCancel={closePanel} />
        ) : (
          selectedProduct && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {panelMode === "info" && <ProductInfoView product={selectedProduct} />}
                {panelMode === "edit" && (
                  <div className="flex flex-col gap-6">
                    <ProductForm form={form} setForm={setForm} categories={categories ?? []} componentOptions={componentOptions} />
                    {inventoryActive && <ProductStockSettings form={form} setForm={setForm} />}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-2 border-t border-neutral-200 px-6 py-3">
                {panelMode === "info" &&
                  (confirmingDelete ? (
                    <div className="flex w-full flex-col gap-2">
                      <p className="text-xs text-neutral-600">¿Eliminar este producto? Esta acción no se puede deshacer.</p>
                      {deleteProduct.isError && (
                        <p className="text-xs text-red-600">
                          {extractErrorMessage(deleteProduct.error, "No se pudo eliminar el producto.")}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1"
                          onClick={() => {
                            setConfirmingDelete(false);
                            deleteProduct.reset();
                          }}
                        >
                          No
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          disabled={deleteProduct.isPending}
                          onClick={() => deleteProduct.mutate()}
                        >
                          Sí, eliminar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Button size="sm" className="flex-1" onClick={openEdit}>
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                        Eliminar
                      </Button>
                    </>
                  ))}
                {panelMode === "edit" && (
                  <>
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setPanelMode("info")}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => updateProduct.mutate()}
                      disabled={!isFormValid || updateProduct.isPending}
                    >
                      Guardar cambios
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        )}
      </SidePanel>

      <SidePanel open={showCategories} onClose={() => setShowCategories(false)} title="Categorías">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <p className="text-xs font-medium uppercase text-neutral-500">Nueva categoría</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catName">Nombre</Label>
              <Input
                id="catName"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catDescription">Descripción</Label>
              <textarea
                id="catDescription"
                className="min-h-16 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <Button
              size="sm"
              onClick={() => createCategory.mutate()}
              disabled={!categoryForm.name.trim() || createCategory.isPending}
              className="w-fit"
            >
              Crear categoría
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase text-neutral-500">Categorías existentes</p>
            {categories && categories.length > 0 ? (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-0.5 rounded-md border border-neutral-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">{category.name}</span>
                    {!category.isActive && (
                      <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-500">
                        Inactiva
                      </span>
                    )}
                  </div>
                  {category.description && <span className="text-xs text-neutral-500">{category.description}</span>}
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No hay categorías todavía.</p>
            )}
          </div>
        </div>
      </SidePanel>
    </div>
  );
}

interface FieldsProps {
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
}

function stockUnitLabel(product: ProductListItem): string {
  if (product.unitType === UnitType.WEIGHT && product.weightUnit) return WEIGHT_UNIT_LABELS[product.weightUnit];
  if (product.unitType === UnitType.VOLUME && product.volumeUnit) return VOLUME_UNIT_LABELS[product.volumeUnit];
  return "unidades";
}

function ProductInfoView({ product }: { product: ProductListItem }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          {product.isActive ? "Activo" : "Borrador"}
        </span>
        {product.isCombo && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase text-neutral-600">Combo</span>
        )}
      </div>

      {product.image && (
        <img src={product.image} alt={product.name} className="h-32 w-full rounded-md border border-neutral-200 object-cover" />
      )}

      {product.description && (
        <div>
          <p className="text-xs font-medium uppercase text-neutral-500">Descripción</p>
          <p className="text-neutral-900">{product.description}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase text-neutral-500">Categoría</p>
        <p className="text-neutral-900">{product.category?.name ?? "Sin categoría"}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase text-neutral-500">Precios</p>
        <div className="flex flex-col gap-0.5">
          {product.prices.map((price) => (
            <p key={price.type} className="text-neutral-900">
              {PRICE_TYPE_LABELS[price.type]}: {formatPrice(price.price)}
            </p>
          ))}
        </div>
      </div>

      {product.isCombo && (
        <div>
          <p className="text-xs font-medium uppercase text-neutral-500">Componentes del combo</p>
          {product.comboComponents.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {product.comboComponents.map((component) => (
                <p key={component.componentId} className="text-neutral-900">
                  {component.component.name} × {component.quantity}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500">Sin componentes cargados.</p>
          )}
        </div>
      )}

      {product.tags.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase text-neutral-500">Etiquetas</p>
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                {PRODUCT_TAG_LABELS[tag]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase text-neutral-500">Stock</p>
        <p className="text-neutral-900">
          {product.trackStock ? `${product.stock} ${stockUnitLabel(product)}` : "Sin control de stock"}
        </p>
      </div>
    </div>
  );
}

function ProductBasicFields({
  form,
  setForm,
  categories,
  showActiveToggle = true,
}: FieldsProps & { categories: CategoryItem[]; showActiveToggle?: boolean }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prodName">Nombre</Label>
        <Input id="prodName" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prodDescription">Descripción</Label>
        <textarea
          id="prodDescription"
          className="min-h-20 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prodCategory">Categoría</Label>
        <select
          id="prodCategory"
          className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          value={form.categoryId}
          onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
        >
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {showActiveToggle && (
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
          />
          Producto activo
        </label>
      )}
    </>
  );
}

function ProductImageField({ form, setForm }: FieldsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="prodImage">Imagen (URL)</Label>
      <Input id="prodImage" value={form.image} onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))} />
    </div>
  );
}

function ProductComboFields({
  form,
  setForm,
  componentOptions,
}: FieldsProps & { componentOptions: { id: string; name: string }[] }) {
  function addComponentRow() {
    setForm((prev) => ({ ...prev, components: [...prev.components, { tempId: crypto.randomUUID(), componentId: "", quantity: "1" }] }));
  }
  function removeComponentRow(tempId: string) {
    setForm((prev) => ({ ...prev, components: prev.components.filter((component) => component.tempId !== tempId) }));
  }
  function updateComponentRow(tempId: string, patch: Partial<ComponentRow>) {
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((component) => (component.tempId === tempId ? { ...component, ...patch } : component)),
    }));
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, isCombo: false, components: [] }))}
          className={cn(
            "flex-1 rounded-lg border p-3 text-left text-sm font-medium",
            !form.isCombo ? "border-red-500 bg-red-50 text-red-700" : "border-neutral-200 text-neutral-700 hover:border-neutral-400",
          )}
        >
          Normal
          <p className="mt-0.5 text-xs font-normal text-neutral-500">Un solo producto</p>
        </button>
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, isCombo: true }))}
          className={cn(
            "flex-1 rounded-lg border p-3 text-left text-sm font-medium",
            form.isCombo ? "border-red-500 bg-red-50 text-red-700" : "border-neutral-200 text-neutral-700 hover:border-neutral-400",
          )}
        >
          Combo
          <p className="mt-0.5 text-xs font-normal text-neutral-500">Agrupa varios productos</p>
        </button>
      </div>

      {form.isCombo && (
        <div className="flex flex-col gap-2">
          <Label>Componentes del combo</Label>
          {form.components.map((row) => (
            <div key={row.tempId} className="flex items-center gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                value={row.componentId}
                onChange={(event) => updateComponentRow(row.tempId, { componentId: event.target.value })}
              >
                <option value="">Elegí un producto</option>
                {componentOptions
                  .filter((option) => option.id === row.componentId || !form.components.some((c) => c.componentId === option.id))
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </select>
              <Input
                type="number"
                min={0.001}
                step="any"
                className="w-24"
                value={row.quantity}
                onChange={(event) => updateComponentRow(row.tempId, { quantity: event.target.value })}
              />
              <button
                type="button"
                onClick={() => removeComponentRow(row.tempId)}
                aria-label="Quitar componente"
                className="rounded-md p-1 text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addComponentRow} className="w-fit">
            <Plus className="h-4 w-4" /> Agregar componente
          </Button>
        </div>
      )}
    </>
  );
}

function ProductPricingFields({ form, setForm }: FieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prodPrice">Precio</Label>
        <Input
          id="prodPrice"
          type="number"
          min={0}
          disabled={form.isFree}
          value={form.prices[PriceType.DINE_IN]}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, prices: { ...prev.prices, [PriceType.DINE_IN]: event.target.value } }))
          }
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={form.isFree}
          onChange={(event) => {
            const isFree = event.target.checked;
            setForm((prev) => ({
              ...prev,
              isFree,
              differentiatedPrices: isFree ? false : prev.differentiatedPrices,
              prices: isFree
                ? { [PriceType.DINE_IN]: "0", [PriceType.TAKE_AWAY]: "0", [PriceType.DELIVERY]: "0" }
                : { ...prev.prices, [PriceType.DINE_IN]: "" },
            }));
          }}
        />
        Gratis (producto de cortesía)
      </label>

      {!form.isFree && (
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={form.differentiatedPrices}
            onChange={(event) => setForm((prev) => ({ ...prev, differentiatedPrices: event.target.checked }))}
          />
          Precios diferenciados (para llevar / delivery)
        </label>
      )}

      {form.differentiatedPrices && !form.isFree && (
        <div className="flex flex-col gap-2">
          {[PriceType.TAKE_AWAY, PriceType.DELIVERY].map((type) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-neutral-600">{PRICE_TYPE_LABELS[type]}</span>
              <Input
                type="number"
                min={0}
                value={form.prices[type]}
                onChange={(event) => setForm((prev) => ({ ...prev, prices: { ...prev.prices, [type]: event.target.value } }))}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ProductTagsFields({ form, setForm }: FieldsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Etiquetas</Label>
      <div className="flex flex-wrap gap-3">
        {Object.values(ProductTag).map((tag) => (
          <label key={tag} className="flex items-center gap-1.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.tags.includes(tag)}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  tags: event.target.checked ? [...prev.tags, tag] : prev.tags.filter((candidate) => candidate !== tag),
                }))
              }
            />
            {PRODUCT_TAG_LABELS[tag]}
          </label>
        ))}
      </div>
    </div>
  );
}

function ProductForm({
  form,
  setForm,
  categories,
  componentOptions,
}: FieldsProps & {
  categories: CategoryItem[];
  componentOptions: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <ProductBasicFields form={form} setForm={setForm} categories={categories} />
      <ProductImageField form={form} setForm={setForm} />
      <ProductComboFields form={form} setForm={setForm} componentOptions={componentOptions} />
      <ProductPricingFields form={form} setForm={setForm} />
      <ProductTagsFields form={form} setForm={setForm} />
    </div>
  );
}

function ProductStockSettings({
  form,
  setForm,
  showInitialStock = false,
}: FieldsProps & { showInitialStock?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-xs font-medium uppercase text-neutral-500">Control de stock</p>

      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={form.trackStock}
          onChange={(event) => setForm((prev) => ({ ...prev, trackStock: event.target.checked }))}
        />
        Controlar stock
      </label>

      {form.trackStock && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prodUnitType">Unidad</Label>
            <select
              id="prodUnitType"
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
              <Label htmlFor="prodWeightUnit">Unidad de peso</Label>
              <select
                id="prodWeightUnit"
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
              <Label htmlFor="prodVolumeUnit">Unidad de volumen</Label>
              <select
                id="prodVolumeUnit"
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

          {showInitialStock && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prodInitialStock">Stock inicial</Label>
              <Input
                id="prodInitialStock"
                type="number"
                min={0}
                value={form.initialStock}
                onChange={(event) => setForm((prev) => ({ ...prev, initialStock: event.target.value }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
