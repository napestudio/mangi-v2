import { CashMovementType, PaymentMethodExtended } from "../enums";

/**
 * Movements of type EXPENSE/REFUND subtract from the session total; the rest add.
 * `type` is typed as `string` (rather than `CashMovementType`) so both the Prisma-generated
 * movement type and the shared enum can be passed in without a cast at the call site.
 */
export function signedCashMovementAmount(type: string, amount: number): number {
  if (type === CashMovementType.EXPENSE || type === CashMovementType.REFUND) return -amount;
  return amount;
}

export interface CashMovementForArqueo {
  type: string;
  method: string;
  amount: number;
}

/**
 * Expected total per payment method for a session: the opening float is cash-only
 * (a register is only ever opened with a physical cash amount), every other method
 * starts at 0 and only appears if it had movements.
 */
export function computeExpectedByMethod(
  openingAmount: number,
  movements: CashMovementForArqueo[],
): Partial<Record<PaymentMethodExtended, number>> {
  const byMethod: Partial<Record<PaymentMethodExtended, number>> = {
    [PaymentMethodExtended.CASH]: openingAmount,
  };

  for (const movement of movements) {
    const signed = signedCashMovementAmount(movement.type, movement.amount);
    byMethod[movement.method as PaymentMethodExtended] = (byMethod[movement.method as PaymentMethodExtended] ?? 0) + signed;
  }

  return byMethod;
}
