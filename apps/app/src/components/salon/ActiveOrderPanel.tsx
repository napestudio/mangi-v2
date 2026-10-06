import { useEffect, useMemo, useState } from "react";
import { TableStatus, type StaffRosterItem } from "@mangiar/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { useStaffRoster } from "@/hooks/useStaffRoster";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import type { FloorPlanTable } from "./FloorPlanCanvas";
import { OpenTableForm } from "./OpenTableForm";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { patchTableStatus } from "./tableCache";
import type { OrderView } from "./types";

interface ActiveOrderPanelProps {
  table: FloorPlanTable;
  onClosePanel: () => void;
}

function initialsFor(userId: string | null, roster: StaffRosterItem[] | undefined): string {
  if (!userId || !roster) return "";
  const staff = roster.find((candidate) => candidate.id === userId);
  if (!staff) return "";
  const label = staff.name ?? staff.username;
  return label
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function orderLabel(order: OrderView, index: number, roster: StaffRosterItem[] | undefined): string {
  const parts = [`#${index + 1}`];
  if (order.guestCount) parts.push(`${order.guestCount}p`);
  const initials = initialsFor(order.assignedToId, roster);
  if (initials) parts.push(initials);
  return parts.join(" · ");
}

export function ActiveOrderPanel({ table, onClosePanel }: ActiveOrderPanelProps) {
  const queryClient = useQueryClient();
  const { restaurant } = useCurrentUser();
  const { data: roster } = useStaffRoster();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", "active", table.id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<OrderView[]>>("/orders", {
        params: { tableId: table.id, status: "PENDING,IN_PROGRESS" },
      });
      return data.data;
    },
  });

  // Keeps this table's panel in sync when another device adds/closes/moves an order
  // on it while this panel is open. Reuses the shared socket connection that
  // salon/index.tsx already owns — only attaches/detaches its own listeners here,
  // never connects/disconnects the socket itself (that would tear it down for the
  // table-status listener too).
  useEffect(() => {
    if (!restaurant?.id) return;
    const socket = connectSocket(restaurant.id);

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["orders", "active", table.id] });
    };
    const handleOrderCreated = (payload: { order?: { tableId?: string | null } }) => {
      if (payload.order?.tableId === table.id) invalidate();
    };

    socket.on("order:created", handleOrderCreated);
    socket.on("order:updated", invalidate);
    socket.on("order:deleted", invalidate);

    return () => {
      socket.off("order:created", handleOrderCreated);
      socket.off("order:updated", invalidate);
      socket.off("order:deleted", invalidate);
    };
  }, [restaurant?.id, table.id, queryClient]);

  const sortedOrders = useMemo(
    () => [...(orders ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders],
  );

  useEffect(() => {
    if (!selectedOrderId && !creatingNew && sortedOrders.length > 0) {
      setSelectedOrderId(sortedOrders[0]!.id);
    }
  }, [sortedOrders, selectedOrderId, creatingNew]);

  function patchOrder(updated: OrderView) {
    queryClient.setQueryData<OrderView[]>(["orders", "active", table.id], (prev) =>
      prev?.map((candidate) => (candidate.id === updated.id ? updated : candidate)) ?? prev,
    );
  }

  /** Shared by checkout, delete-empty, and move-away: the order leaves this table's active list. */
  function removeOrderFromTable(orderId: string) {
    const remaining = sortedOrders.filter((candidate) => candidate.id !== orderId);
    queryClient.setQueryData<OrderView[]>(["orders", "active", table.id], remaining);
    if (remaining.length === 0) {
      patchTableStatus(queryClient, table.id, TableStatus.EMPTY);
      onClosePanel();
    } else {
      setSelectedOrderId(remaining[0]!.id);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Cargando pedido...</p>;
  }

  if (sortedOrders.length === 0 && !creatingNew) {
    return <OpenTableForm table={table} onCreated={(order) => setSelectedOrderId(order.id)} />;
  }

  const selectedOrder = sortedOrders.find((candidate) => candidate.id === selectedOrderId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sortedOrders.map((order, index) => (
          <button
            key={order.id}
            type="button"
            onClick={() => {
              setSelectedOrderId(order.id);
              setCreatingNew(false);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              !creatingNew && order.id === selectedOrderId
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
            )}
          >
            {orderLabel(order, index, roster)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCreatingNew(true)}
          className={cn(
            "rounded-full border border-dashed px-3 py-1 text-xs font-medium",
            creatingNew
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100",
          )}
        >
          + Nueva orden
        </button>
      </div>

      {creatingNew ? (
        <OpenTableForm
          table={table}
          onCreated={(order) => {
            setCreatingNew(false);
            setSelectedOrderId(order.id);
          }}
        />
      ) : (
        selectedOrder && (
          <OrderDetailPanel
            order={selectedOrder}
            table={table}
            onOrderUpdated={patchOrder}
            onOrderClosed={removeOrderFromTable}
            onOrderRemoved={removeOrderFromTable}
            onOrderMoved={removeOrderFromTable}
          />
        )
      )}
    </div>
  );
}
