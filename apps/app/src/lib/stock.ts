export interface StockAwareProduct {
  trackStock: boolean;
  stock: string | number;
  comboComponents?: { quantity: string | number; component: { trackStock: boolean; stock: string | number } }[];
}

/** Espeja la regla de OrdersService.applyStockForOrderItem: chequea el stock propio del producto/combo
 * Y el de cada componente trackeado, de forma independiente. Si este helper y el backend se desalinean,
 * la UI podría mostrar vendible algo que el server termina bloqueando. */
export function isProductAvailable(product: StockAwareProduct, quantity: number): boolean {
  if (product.trackStock && Number(product.stock) < quantity) return false;
  for (const componentLink of product.comboComponents ?? []) {
    if (componentLink.component.trackStock && Number(componentLink.component.stock) < Number(componentLink.quantity) * quantity) {
      return false;
    }
  }
  return true;
}
