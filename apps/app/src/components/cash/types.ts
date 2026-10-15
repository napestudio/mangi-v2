import { CashMovementType, type PaymentMethodExtended } from "@mangiar/shared";

export interface StaffRef {
  id: string;
  name: string | null;
  username: string;
}

export interface CashMovementItem {
  id: string;
  type: CashMovementType;
  method: PaymentMethodExtended;
  amount: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
}

export interface CashMovementListItem extends CashMovementItem {
  createdBy: StaffRef | null;
  session: {
    id: string;
    status: "OPEN" | "CLOSED";
    cashRegister: { id: string; name: string };
  };
}

export interface MethodCountItem {
  id: string;
  method: PaymentMethodExtended;
  expectedAmount: string;
  countedAmount: string;
  variance: string;
}

export interface CashSessionDetail {
  id: string;
  status: "OPEN" | "CLOSED";
  openingAmount: string;
  closingAmount: string | null;
  expectedAmount: string | null;
  variance: string | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  movements: CashMovementItem[];
  methodCounts: MethodCountItem[];
  openedBy: StaffRef | null;
  closedBy: StaffRef | null;
}

export const MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  [CashMovementType.INCOME]: "Ingreso",
  [CashMovementType.EXPENSE]: "Egreso",
  [CashMovementType.SALE]: "Venta",
  [CashMovementType.REFUND]: "Reembolso",
  [CashMovementType.CORRECTION]: "Ajuste",
};
