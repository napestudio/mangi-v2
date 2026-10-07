import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  /** Si es false, el botón "Siguiente" de este paso queda deshabilitado. Default true. */
  isValid?: boolean;
  /** Se muestra junto al label cuando el paso no es obligatorio para avanzar (ej. "Etiquetas (opcional)"). */
  optional?: boolean;
  /** Reemplaza el botón "Siguiente" default de ESTE paso por contenido propio (ej. uno o varios
   * botones de guardado en el último paso, con sus propios labels) — queda fijo al fondo igual que
   * "Siguiente"/"Atrás", nunca dentro del área scrolleable de `content`. */
  footer?: ReactNode;
}

interface WizardProps {
  steps: WizardStep[];
  /** Botón "Cancelar" en el primer paso (no hay "Atrás" ahí). Omitir si no aplica. */
  onCancel?: () => void;
}

/**
 * Shell de navegación por pasos — solo maneja el índice actual, el indicador visual y los botones
 * Atrás/Siguiente/Cancelar. El contenido de cada paso lo decide siempre el consumidor; si necesita
 * una acción final distinta de "Siguiente" (ej. "Guardar borrador" + "Guardar y publicar"), la pasa
 * en `footer`, no la mete dentro de `content` — `content` es la única parte que scrollea, todo lo
 * demás (indicador, label, nav) queda fijo arriba/abajo del panel que lo contiene (pensado para vivir
 * dentro de un `SidePanel` con `bodyClassName="flex min-h-0 flex-1 flex-col"`).
 */
export function Wizard({ steps, onCancel }: WizardProps) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const canAdvance = step.isValid ?? true;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-6 pt-4">
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center last:flex-none">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  i < index
                    ? "bg-red-500 text-white"
                    : i === index
                      ? "border-2 border-red-500 text-red-500"
                      : "border border-neutral-300 text-neutral-400",
                )}
              >
                {i < index ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={cn("h-0.5 flex-1", i < index ? "bg-red-500" : "bg-neutral-200")} />}
            </div>
          ))}
        </div>

        <p className="text-sm font-semibold text-neutral-900">
          {step.label}
          {step.optional && <span className="ml-1 font-normal text-neutral-500">(opcional)</span>}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-3">{step.content}</div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-neutral-200 px-6 py-3">
        {isFirst
          ? onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            )
          : (
              <Button type="button" variant="ghost" onClick={() => setIndex((current) => current - 1)}>
                Atrás
              </Button>
            )}
        <div className="flex flex-1 gap-2">
          {step.footer ??
            (!isLast && (
              <Button type="button" className="flex-1" disabled={!canAdvance} onClick={() => setIndex((current) => current + 1)}>
                Siguiente
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
