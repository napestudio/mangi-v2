import { useMemo, useState } from "react";
import { Module, PaymentMethodExtended } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { isProductAvailable } from "@/lib/stock";
import { cn } from "@/lib/utils";

interface ProductPrice {
  type: string;
  price: string;
}

interface ProductOption {
  id: string;
  name: string;
  isActive: boolean;
  category: { id: string; name: string } | null;
  prices: ProductPrice[];
  trackStock: boolean;
  stock: string;
  comboComponents: { quantity: string; component: { trackStock: boolean; stock: string } }[];
}

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface CashRegisterWithOpenSession {
  id: string;
  name: string;
  sessions: { id: string }[];
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethodExtended, string> = {
  [PaymentMethodExtended.CASH]: "Efectivo",
  [PaymentMethodExtended.CARD_DEBIT]: "Débito",
  [PaymentMethodExtended.CARD_CREDIT]: "Crédito",
  [PaymentMethodExtended.TRANSFER]: "Transferencia",
  [PaymentMethodExtended.PAYMENT_LINK]: "Link de pago",
  [PaymentMethodExtended.QR_CODE]: "QR",
  [PaymentMethodExtended.ACCOUNT]: "Cuenta corriente",
};

const UNCATEGORIZED = "__uncategorized__";

export const Route = createFileRoute("/_app/pos/counter")({
  component: CounterPosPage,
});

function CounterPosPage() {
  const queryClient = useQueryClient();
  const { hasModule } = useModules();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethodExt, setPaymentMethodExt] =
    useState<PaymentMethodExtended>(PaymentMethodExtended.CASH);
  const [sessionId, setSessionId] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<ProductOption[]>>("/products");
      return data.data;
    },
  });

  const { data: registers } = useQuery({
    queryKey: ["cash-registers"],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<CashRegisterWithOpenSession[]>>(
          "/cash-registers",
        );
      return data.data;
    },
    enabled: hasModule(Module.CASH),
  });

  const openSessions =
    registers
      ?.filter((register) => register.sessions.length > 0)
      .map((register) => ({
        id: register.sessions[0]!.id,
        label: register.name,
      })) ?? [];

  const sellableProducts = useMemo(
    () =>
      (products ?? []).filter(
        (product) =>
          product.isActive &&
          product.prices.some((price) => price.type === "TAKE_AWAY"),
      ),
    [products],
  );

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of sellableProducts) {
      const id = product.category?.id ?? UNCATEGORIZED;
      const name = product.category?.name ?? "Sin categoría";
      if (!seen.has(id)) seen.set(id, name);
    }
    return Array.from(seen.entries());
  }, [sellableProducts]);

  const visibleProducts =
    activeCategory === "all"
      ? sellableProducts
      : sellableProducts.filter(
          (product) =>
            (product.category?.id ?? UNCATEGORIZED) === activeCategory,
        );

  const total = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  function addToCart(product: ProductOption) {
    const price = product.prices.find((p) => p.type === "TAKE_AWAY");
    if (!price) return;
    const cartQuantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
    if (!isProductAvailable(product, cartQuantity + 1)) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(price.price),
          quantity: 1,
        },
      ];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function resetSale() {
    setCart([]);
    setCheckingOut(false);
    setSessionId("");
    setPaymentMethodExt(PaymentMethodExtended.CASH);
  }

  const checkout = useMutation({
    mutationFn: async () => {
      const { data: orderResponse } = await apiClient.post<
        ApiEnvelope<{ id: string }>
      >("/orders", {
        type: "COUNTER",
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });
      const orderId = orderResponse.data.id;

      await apiClient.patch(`/orders/${orderId}/checkout`, {
        paymentMethodExt,
        sessionId: hasModule(Module.CASH) ? sessionId || undefined : undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setSuccessMessage("Venta cobrada correctamente.");
      resetSale();
      setTimeout(() => setSuccessMessage(null), 4000);
    },
  });

  return (
    <div className="flex h-full gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Mostrador</h1>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
              activeCategory === "all"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
            )}
          >
            Todos
          </button>
          {categories.map(([id, name]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveCategory(id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                activeCategory === id
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
              )}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-neutral-500">Cargando productos...</p>
          )}
          {!isLoading && visibleProducts.length === 0 && (
            <p className="text-sm text-neutral-500">
              No hay productos disponibles para venta de mostrador.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => {
              const price = product.prices.find((p) => p.type === "TAKE_AWAY")!;
              const cartQuantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
              const available = isProductAvailable(product, cartQuantity + 1);
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={!available}
                  onClick={() => addToCart(product)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-sm transition hover:border-neutral-400 hover:shadow active:scale-[0.98]",
                    !available && "cursor-not-allowed opacity-40 hover:border-neutral-200 hover:shadow-sm active:scale-100",
                  )}
                >
                  <span className="text-sm font-medium text-neutral-900">
                    {product.name}
                  </span>
                  {available ? (
                    <span className="text-sm text-neutral-500">
                      {formatPrice(price.price)}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-red-600">Sin stock</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex w-80 shrink-0 flex-col rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center gap-2 border-b border-neutral-200 p-3">
          <ShoppingCart className="h-4 w-4 text-neutral-500" />
          <h2 className="font-semibold text-neutral-900">Pedido</h2>
        </div>

        {successMessage && (
          <p className="mx-3 mt-3 rounded-md bg-emerald-50 px-2 py-1.5 text-sm text-emerald-800">
            {successMessage}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 && (
            <p className="text-sm text-neutral-500">
              Tocá un producto para agregarlo.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {cart.map((item) => {
              const product = products?.find((candidate) => candidate.id === item.productId);
              const canIncrement = !product || isProductAvailable(product, item.quantity + 1);
              return (
                <div
                  key={item.productId}
                  className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatPrice(item.unitPrice)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => changeQuantity(item.productId, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={!canIncrement}
                      onClick={() => changeQuantity(item.productId, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-600"
                      onClick={() => removeFromCart(item.productId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-200 p-3">
          {!checkingOut && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-500">
                  Total
                </span>
                <span className="text-xl font-semibold text-neutral-900">
                  {formatPrice(total)}
                </span>
              </div>
              <Button
                className="h-12 text-base"
                disabled={cart.length === 0}
                onClick={() => setCheckingOut(true)}
              >
                Cobrar
              </Button>
            </>
          )}

          {checkingOut && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500">
                  Método de pago
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.values(PaymentMethodExtended).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethodExt(method)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-sm font-medium",
                        paymentMethodExt === method
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-400",
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[method]}
                    </button>
                  ))}
                </div>
              </div>

              {hasModule(Module.CASH) && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500">
                    Caja
                  </p>
                  <select
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
                    value={sessionId}
                    onChange={(event) => setSessionId(event.target.value)}
                  >
                    <option value="">Sin registrar en caja</option>
                    {openSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-500">
                  Total
                </span>
                <span className="text-xl font-semibold text-neutral-900">
                  {formatPrice(total)}
                </span>
              </div>

              {checkout.isError && (
                <p className="text-sm text-red-600">
                  No se pudo cobrar el pedido.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 h-12 text-base"
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate()}
                >
                  Confirmar cobro
                </Button>
                <Button variant="ghost" onClick={() => setCheckingOut(false)}>
                  Volver
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
