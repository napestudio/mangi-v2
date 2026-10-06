import { OrderType } from "../enums";

/** First two letters of a one-word restaurant name, or one initial per word otherwise. */
export function restaurantInitials(restaurantName: string): string {
  const words = restaurantName.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return (words[0] ?? "").slice(0, 2).toUpperCase();
  }
  return words.map((word) => word[0]).join("").toUpperCase();
}

const ORDER_TYPE_CODE: Record<OrderType, string> = {
  [OrderType.DINE_IN]: "DI",
  [OrderType.TAKE_AWAY]: "TA",
  [OrderType.DELIVERY]: "DE",
  [OrderType.COUNTER]: "CO",
};

/**
 * Human-friendly order identifier, ej. "MGDI-37" — `orderNumber` resets daily per
 * restaurant+type (see `OrderNumberCounter`), so this stays short no matter the volume.
 * Not globally unique: two different days (or types) can produce the same code.
 */
export function buildOrderCode(restaurantName: string, orderType: OrderType, orderNumber: number): string {
  return `${restaurantInitials(restaurantName)}${ORDER_TYPE_CODE[orderType]}-${orderNumber}`;
}
