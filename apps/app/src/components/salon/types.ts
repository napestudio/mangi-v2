import type { OrderStatus, OrderType, PriceType } from "@mangiar/shared";

export interface ProductPrice {
  type: PriceType;
  price: string;
}

export interface ProductComponentLink {
  quantity: string;
  component: { id: string; name: string; trackStock: boolean; stock: string };
}

export interface ProductOption {
  id: string;
  name: string;
  isActive: boolean;
  category: { id: string; name: string } | null;
  prices: ProductPrice[];
  trackStock: boolean;
  stock: string;
  comboComponents: ProductComponentLink[];
}

export interface OrderItemModifierView {
  id: string;
  name: string;
  priceAdj: string;
}

export interface OrderItemView {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  notes: string | null;
  sentToKitchen: boolean;
  stockDeducted: boolean;
  modifiers: OrderItemModifierView[];
}

export interface OrderView {
  id: string;
  code: string;
  type: OrderType;
  status: OrderStatus;
  tableId: string | null;
  clientId: string | null;
  assignedToId: string | null;
  guestCount: number | null;
  subtotal: string;
  discountAmount: string;
  deliveryFee: string;
  total: string;
  items: OrderItemView[];
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface StagedItem {
  tempId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}
