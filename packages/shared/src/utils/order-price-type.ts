import { OrderType, PriceType } from "../enums";

/** Maps an order's type to the `ProductPrice.type` it should be priced against. */
export function toPriceType(orderType: OrderType): PriceType {
  if (orderType === OrderType.DELIVERY) return PriceType.DELIVERY;
  if (orderType === OrderType.TAKE_AWAY || orderType === OrderType.COUNTER) return PriceType.TAKE_AWAY;
  return PriceType.DINE_IN;
}
