export function formatPrice(value: number | string): string {
  const num = Number(value);
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const hasCents = Math.round(abs * 100) % 100 !== 0;

  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs);

  return `${isNegative ? "-" : ""}$${formatted}`;
}
