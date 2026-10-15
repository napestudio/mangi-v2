export const PAPER_WIDTH_OPTIONS = [58, 80] as const;
export type PaperWidthMm = (typeof PAPER_WIDTH_OPTIONS)[number];

/** Caracteres por línea aproximados para una impresora térmica ESC/POS según el ancho del rollo.
 * Debe mantenerse en sync con la copia duplicada en apps/desktop/src/main/printing.ts (ese paquete
 * no depende de @mangiar/shared). No calibrado contra hardware real — ver mangiar-printing SKILL.md. */
export function getCharsPerLine(paperWidthMm: number): number {
  return paperWidthMm >= 80 ? 48 : 32;
}
