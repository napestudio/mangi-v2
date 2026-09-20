import { createOrderSchema, OrderType, type CreateOrderPayload } from "@mangiar/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface ProductOption {
  id: string;
  name: string;
}

export const Route = createFileRoute("/_app/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ProductOption[]>>("/products");
      return data.data;
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { type: OrderType.DINE_IN, items: [{ productId: "", quantity: 1, modifiers: [] }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

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
                    {type}
                  </option>
                ))}
              </select>
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
