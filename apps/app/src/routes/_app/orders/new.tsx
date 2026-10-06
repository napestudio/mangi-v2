import { createOrderSchema, Module, OrderType, type BusinessHoursStatus, type CreateOrderPayload } from "@mangiar/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { StaffPicker } from "@/components/staff/StaffPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { ORDER_TYPE_LABELS } from "@/lib/labels";

interface ProductOption {
  id: string;
  name: string;
}

interface DeliveryZoneOption {
  id: string;
  name: string;
  fee: string;
  isActive: boolean;
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
  const selectedType = watch("type");

  const { data: deliveryZones } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<DeliveryZoneOption[]>>("/delivery-zones");
      return data.data;
    },
    enabled: hasModule(Module.DELIVERY) && selectedType === OrderType.DELIVERY,
  });

  const createOrder = useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const { data } = await apiClient.post<ApiEnvelope<{ id: string }>>("/orders", payload);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void navigate({ to: "/orders" });
    },
  });

  const onSubmit = handleSubmit((values) => createOrder.mutate(values));

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
                        {zone.name} — ${zone.fee}
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
                      <option key={product.id} value={product.id}>
                        {product.name}
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

            {createOrder.isError && <p className="text-sm text-red-600">No se pudo crear el pedido</p>}
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? "Creando..." : "Crear pedido"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
