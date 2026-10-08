import {
  createOrderSchema,
  Module,
  OrderType,
  TableStatus,
  type BusinessHoursStatus,
  type CreateOrderPayload,
} from "@mangiar/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { patchTableStatus } from "@/components/salon/tableCache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { ORDER_TYPE_LABELS } from "@/lib/labels";
import { isProductAvailable } from "@/lib/stock";

interface ProductOption {
  id: string;
  name: string;
  trackStock: boolean;
  stock: string;
  comboComponents: { quantity: string; component: { trackStock: boolean; stock: string } }[];
}

interface DeliveryZoneOption {
  id: string;
  name: string;
  fee: string;
  isActive: boolean;
}

interface TableOption {
  id: string;
  number: string;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

export const Route = createFileRoute("/_app/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { hasModule } = useModules();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ProductOption[]>>("/products");
      return data.data;
    },
  });

  const { data: hoursStatus } = useQuery({
    queryKey: ["business-hours-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<BusinessHoursStatus>>("/business-hours/status");
      return data.data;
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      type: OrderType.DINE_IN,
      items: [{ productId: "", quantity: 1, modifiers: [] }],
      assignedToId: user?.id,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  // react(incompatible-library): react-hook-form's watch() isn't memo-safe, so React
  // Compiler skips optimizing this component. Known react-hook-form limitation, not a bug.
  const selectedType = watch("type");

  const { data: deliveryZones } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<DeliveryZoneOption[]>>("/delivery-zones");
      return data.data;
    },
    enabled: hasModule(Module.DELIVERY) && selectedType === OrderType.DELIVERY,
  });

  const { data: tables } = useQuery({
    queryKey: ["tables", "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TableOption[]>>("/tables");
      return data.data;
    },
    enabled: hasModule(Module.SALON) && selectedType === OrderType.DINE_IN,
  });

  const createOrder = useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const { data } = await apiClient.post<ApiEnvelope<{ id: string }>>("/orders", payload);
      return data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (variables.type === OrderType.DINE_IN && variables.tableId) {
        patchTableStatus(queryClient, variables.tableId, TableStatus.OCCUPIED);
      }
      void navigate({ to: "/orders" });
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (values.type === OrderType.DINE_IN && hasModule(Module.SALON) && !values.tableId) {
      setError("tableId", { message: "Seleccioná una mesa" });
      return;
    }
    // react-hook-form keeps a hidden field's last value after it unmounts (no `shouldUnregister`),
    // so switching away from "Mesa" (DINE_IN) can leave a stale tableId in `values` — drop it here.
    createOrder.mutate({ ...values, tableId: values.type === OrderType.DINE_IN ? values.tableId : undefined });
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Nuevo pedido</h1>
      {hoursStatus && !hoursStatus.isOpen && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El local figura cerrado según el horario configurado. Podés cargar el pedido igual.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Detalle del pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                {...register("type")}
              >
                {Object.values(OrderType).map((type) => (
                  <option key={type} value={type}>
                    {ORDER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {selectedType === OrderType.DINE_IN && hasModule(Module.SALON) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tableId">Mesa</Label>
                <select
                  id="tableId"
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  {...register("tableId")}
                >
                  <option value="">Seleccioná una mesa</option>
                  {tables?.map((table) => (
                    <option key={table.id} value={table.id}>
                      Mesa {table.number}
                    </option>
                  ))}
                </select>
                {errors.tableId && <p className="text-xs text-red-600">{errors.tableId.message}</p>}
              </div>
            )}

            {selectedType === OrderType.DELIVERY && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deliveryAddress">Dirección de entrega</Label>
                <Input id="deliveryAddress" {...register("deliveryAddress")} />
                {errors.deliveryAddress && <p className="text-xs text-red-600">{errors.deliveryAddress.message}</p>}
              </div>
            )}

            {selectedType === OrderType.DELIVERY && hasModule(Module.DELIVERY) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deliveryZoneId">Zona de entrega</Label>
                <select
                  id="deliveryZoneId"
                  className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  {...register("deliveryZoneId")}
                >
                  <option value="">Sin zona (costo de envío por defecto)</option>
                  {deliveryZones
                    ?.filter((zone) => zone.isActive)
                    .map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} — {formatPrice(zone.fee)}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignedToId">Asignado a</Label>
              <Controller
                control={control}
                name="assignedToId"
                render={({ field }) => (
                  <StaffPicker id="assignedToId" value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <div className="flex flex-col gap-3">
              <Label>Productos</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <select
                    className="h-10 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                    {...register(`items.${index}.productId` as const)}
                  >
                    <option value="">Seleccioná un producto</option>
                    {products?.map((product) => (
                      <option key={product.id} value={product.id} disabled={!isProductAvailable(product, 1)}>
                        {product.name}
                        {!isProductAvailable(product, 1) ? " (Sin stock)" : ""}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                    Quitar
                  </Button>
                </div>
              ))}
              {errors.items && <p className="text-xs text-red-600">Revisá los productos seleccionados</p>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: "", quantity: 1, modifiers: [] })}
              >
                Agregar producto
              </Button>
            </div>

            {createOrder.isError && (
              <p className="text-sm text-red-600">{extractErrorMessage(createOrder.error, "No se pudo crear el pedido")}</p>
            )}
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? "Creando..." : "Crear pedido"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
