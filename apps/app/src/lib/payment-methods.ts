import { PaymentMethodExtended } from "@mangiar/shared";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodExtended, string> = {
  [PaymentMethodExtended.CASH]: "Efectivo",
  [PaymentMethodExtended.CARD_DEBIT]: "Débito",
  [PaymentMethodExtended.CARD_CREDIT]: "Crédito",
  [PaymentMethodExtended.TRANSFER]: "Transferencia",
  [PaymentMethodExtended.PAYMENT_LINK]: "Link de pago",
  [PaymentMethodExtended.QR_CODE]: "QR",
  [PaymentMethodExtended.ACCOUNT]: "Cuenta corriente",
};
