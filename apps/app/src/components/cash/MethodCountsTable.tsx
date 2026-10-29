import { formatPrice } from "@/lib/currency";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type { MethodCountItem } from "./types";

function varianceClass(variance: number): string {
  if (variance === 0) return "text-neutral-900";
  return variance > 0 ? "text-emerald-600" : "text-red-600";
}

interface MethodCountsTableProps {
  counts: MethodCountItem[];
  className?: string;
}

export function MethodCountsTable({ counts, className }: MethodCountsTableProps) {
  if (counts.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1 text-sm", className)}>
      <div className="grid grid-cols-4 gap-2 text-xs font-medium uppercase text-neutral-500">
        <span>Método</span>
        <span className="text-right">Esperado</span>
        <span className="text-right">Contado</span>
        <span className="text-right">Diferencia</span>
      </div>
      {counts.map((count) => (
        <div key={count.id} className="grid grid-cols-4 gap-2">
          <span>{PAYMENT_METHOD_LABELS[count.method]}</span>
          <span className="text-right">{formatPrice(count.expectedAmount)}</span>
          <span className="text-right">{formatPrice(count.countedAmount)}</span>
          <span className={cn("text-right font-medium", varianceClass(Number(count.variance)))}>
            {formatPrice(count.variance)}
          </span>
        </div>
      ))}
    </div>
  );
}
