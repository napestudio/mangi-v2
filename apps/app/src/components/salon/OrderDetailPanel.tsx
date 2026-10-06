import { useState } from "react";
import { OrderType, toPriceType } from "@mangiar/shared";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeftRight, Minus, Plus, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { FloorPlanTable } from "./FloorPlanCanvas";
import { CloseTableCheckout } from "./CloseTableCheckout";
import { MoveOrderTablePicker } from "./MoveOrderTablePicker";
import { NoteEditor } from "./NoteEditor";
import { ProductSearchCombobox } from "./ProductSearchCombobox";
import type { OrderView, ProductOption, StagedItem } from "./types";

interface OrderDetailPanelProps {
  order: OrderView;
  /** Omit when managing an order with no table (ej. `/orders` genérico) — oculta "Mover a otra mesa". */
  table?: FloorPlanTable;
  onOrderUpdated: (order: OrderView) => void;
  onOrderClosed: (orderId: string) => void;
  onOrderRemoved: (orderId: string) => void;
  onOrderMoved?: (orderId: string) => void;
  className?: string;
}

export function OrderDetailPanel({
  order,
  table,
  onOrderUpdated,
  onOrderClosed,
  onOrderRemoved,
  onOrderMoved,
  className,
}: OrderDetailPanelProps) {
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [pendingRemoveItemId, setPendingRemoveItemId] = useState<string | null>(null);

  const addItems = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiEnvelope<OrderView>>(`/orders/${order.id}/items`, {
        items: staged.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          unitPrice: item.unitPrice,
        })),
      });
      return data.data;
    },
    onSuccess: (updated) => {
      onOrderUpdated(updated);
      setStaged([]);
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await apiClient.delete<ApiEnvelope<OrderView>>(`/orders/${order.id}/items/${itemId}`);
      return data.data;
    },
    onSuccess: (updated) => {
      onOrderUpdated(updated);
      setPendingRemoveItemId(null);
    },
  });

  const removeEmptyOrder = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/orders/${order.id}`);
    },
    onSuccess: () => onOrderRemoved(order.id),
  });

  const reprintKitchenTicket = useMutation({
    mutationFn: async () => {
      if (order.items.length === 0) return;
      await apiClient.patch(`/orders/${order.id}/send-to-kitchen`, {
        itemIds: order.items.map((item) => item.id),
      });
    },
  });

  function addStaged(product: ProductOption, unitPrice: number) {
    setStaged((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { tempId: crypto.randomUUID(), productId: product.id, name: product.name, quantity: 1, unitPrice }];
    });
  }

  function changeStagedQuantity(tempId: string, delta: number) {
    setStaged((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item)),
    );
  }

  function changeStagedPrice(tempId: string, unitPrice: number) {
    setStaged((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, unitPrice } : item)));
  }

  function changeStagedNotes(tempId: string, notes: string | undefined) {
    setStaged((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, notes } : item)));
  }

  function removeStaged(tempId: string) {
    setStaged((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  const stagedTotal = staged.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const hasConfirmedItems = order.items.length > 0;
  const priceType = toPriceType(order.type);
  const canMoveTable = order.type === OrderType.DINE_IN && !!order.tableId;

  if (showMovePicker && order.tableId) {
    return (
      <div className={cn("overflow-y-auto", className)}>
        <MoveOrderTablePicker
          order={order}
          currentTable={table ?? { id: order.tableId }}
          onCancel={() => setShowMovePicker(false)}
          onMoved={() => onOrderMoved?.(order.id)}
        />
      </div>
    );
  }

  if (showCheckout) {
    return (
      <div className={cn("overflow-y-auto", className)}>
        <CloseTableCheckout order={order} onCancel={() => setShowCheckout(false)} onClosed={() => onOrderClosed(order.id)} />
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-4", className)}>
      <div className="flex shrink-0 items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => reprintKitchenTicket.mutate()}
          disabled={!hasConfirmedItems || reprintKitchenTicket.isPending}
          aria-label="Reimprimir comanda"
          title="Reimprimir comanda"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
        </button>
        {canMoveTable && (
          <button
            type="button"
            onClick={() => setShowMovePicker(true)}
            aria-label="Mover a otra mesa"
            title="Mover a otra mesa"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="shrink-0">
        <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500">Adicionar</p>
        <ProductSearchCombobox priceType={priceType} onSelect={addStaged} />
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto">
        {staged.length > 0 && (
          <div className="flex flex-col gap-3">
            {staged.map((item) => (
              <div key={item.tempId} className="rounded-md border border-neutral-200 p-3">
                <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => changeStagedQuantity(item.tempId, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => changeStagedQuantity(item.tempId, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-neutral-500">$</span>
                    <Input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(event) => changeStagedPrice(item.tempId, Number(event.target.value))}
                      className="h-8 w-20 px-2 text-sm"
                    />
                  </div>
                  <NoteEditor value={item.notes} onChange={(notes) => changeStagedNotes(item.tempId, notes)} />
                  <button
                    type="button"
                    onClick={() => removeStaged(item.tempId)}
                    aria-label="Quitar"
                    className="ml-auto rounded-md p-1 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasConfirmedItems && staged.length === 0 && (
          <div className="flex flex-col gap-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
                      <span className="shrink-0 text-xs font-medium text-neutral-500">x{item.quantity}</span>
                    </div>
                    {item.notes && <p className="text-xs italic text-neutral-500">Nota: {item.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">{formatCurrency(Number(item.totalPrice))}</span>
                    <button
                      type="button"
                      onClick={() => (item.sentToKitchen ? setPendingRemoveItemId(item.id) : removeItem.mutate(item.id))}
                      aria-label="Eliminar producto"
                      className="rounded-md p-1 text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {pendingRemoveItemId === item.id && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-600">Ya fue comandado. ¿Eliminarlo igual?</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setPendingRemoveItemId(null)}>
                        No
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={removeItem.isPending}
                        onClick={() => removeItem.mutate(item.id)}
                      >
                        Sí
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {staged.length > 0 ? (
        <div className="flex shrink-0 flex-col gap-3 border-t border-neutral-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-500">Total a confirmar:</span>
            <span className="text-lg font-semibold text-neutral-900">{formatCurrency(stagedTotal)}</span>
          </div>
          {addItems.isError && <p className="text-sm text-red-600">No se pudieron agregar los productos.</p>}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setStaged([])}>
              Cancelar
            </Button>
            <Button type="button" className="flex-1" disabled={addItems.isPending} onClick={() => addItems.mutate()}>
              Confirmar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200 pt-3">
          {hasConfirmedItems && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-900">Total:</span>
              <span className="text-lg font-semibold text-neutral-900">{formatCurrency(Number(order.total))}</span>
            </div>
          )}
          {removeEmptyOrder.isError && <p className="text-sm text-red-600">No se pudo eliminar el pedido.</p>}
          {!hasConfirmedItems ? (
            <Button
              type="button"
              variant="destructive"
              className="h-12 text-base"
              disabled={removeEmptyOrder.isPending}
              onClick={() => removeEmptyOrder.mutate()}
            >
              Eliminar Orden Vacia
            </Button>
          ) : (
            <Button type="button" className="h-12 text-base" onClick={() => setShowCheckout(true)}>
              Finalizar Venta
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
