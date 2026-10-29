import { signedCashMovementAmount } from "@mangiar/shared";
import { formatPrice } from "@/lib/currency";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import { formatTime } from "./datetime";
import { MOVEMENT_TYPE_LABELS, type CashMovementItem } from "./types";

interface MovementsListProps {
  movements: CashMovementItem[];
  emptyMessage?: string;
  className?: string;
}

function MovementRow({ movement }: { movement: CashMovementItem }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 py-2.5 first:pt-0 last:border-b-0">
      <span>
        {MOVEMENT_TYPE_LABELS[movement.type]} · {PAYMENT_METHOD_LABELS[movement.method]}{" "}
        <span className="text-xs text-neutral-400">{formatTime(movement.createdAt)}</span>
      </span>
      <span className="shrink-0 font-medium">{formatPrice(movement.amount)}</span>
    </div>
  );
}

function MovementGroup({
  title,
  movements,
  totalClassName,
}: {
  title: string;
  movements: CashMovementItem[];
  totalClassName: string;
}) {
  if (movements.length === 0) return null;
  const total = movements.reduce((sum, movement) => sum + Number(movement.amount), 0);
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between py-1">
        <p className="text-xs font-medium uppercase text-neutral-500">{title}</p>
        <p className={cn("text-xs font-semibold", totalClassName)}>{formatPrice(total)}</p>
      </div>
      <div className="flex flex-col">
        {movements.map((movement) => (
          <MovementRow key={movement.id} movement={movement} />
        ))}
      </div>
    </div>
  );
}

export function MovementsList({ movements, emptyMessage = "Sin movimientos todavía.", className }: MovementsListProps) {
  if (movements.length === 0) {
    return <p className={cn("text-sm text-neutral-500", className)}>{emptyMessage}</p>;
  }

  const income = movements.filter((movement) => signedCashMovementAmount(movement.type, 1) >= 0);
  const expenses = movements.filter((movement) => signedCashMovementAmount(movement.type, 1) < 0);

  return (
    <div className={cn("flex flex-col gap-4 text-sm", className)}>
      <MovementGroup title="Ingresos" movements={income} totalClassName="text-emerald-600" />
      <MovementGroup title="Egresos" movements={expenses} totalClassName="text-red-600" />
    </div>
  );
}
