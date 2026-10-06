import { OrderStatus, OrderType } from "@mangiar/shared";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [OrderType.DINE_IN]: "Mesa",
  [OrderType.TAKE_AWAY]: "Para llevar",
  [OrderType.DELIVERY]: "Delivery",
  [OrderType.COUNTER]: "Mostrador",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "Pendiente",
  [OrderStatus.IN_PROGRESS]: "En curso",
  [OrderStatus.COMPLETED]: "Completado",
  [OrderStatus.CANCELED]: "Cancelado",
};
