import { useState } from "react";
import { Module } from "@mangiar/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModules } from "@/hooks/useModules";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface PrinterOption {
  id: string;
  name: string;
  isActive: boolean;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}

interface PrintSessionButtonProps {
  sessionId: string;
  className?: string;
}

/** Botón "Imprimir" para el detalle de una sesión de caja (abierta o cerrada) — encola un `PrintJob`
 * tipo `cash_session` contra la impresora elegida, mismo pipeline que comandas/recibos (ver
 * mangiar-printing). No se muestra si el módulo Impresión no está activo o no hay ninguna impresora
 * activa configurada. */
export function PrintSessionButton({ sessionId, className }: PrintSessionButtonProps) {
  const { hasModule } = useModules();
  const printingActive = hasModule(Module.PRINTING);

  const [printerId, setPrinterId] = useState("");

  const { data: printers } = useQuery({
    queryKey: ["printers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<PrinterOption[]>>("/printers");
      return data.data;
    },
    enabled: printingActive,
  });

  const activePrinters = (printers ?? []).filter((printer) => printer.isActive);
  const effectivePrinterId = printerId || activePrinters[0]?.id || "";

  const printSession = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/cash-sessions/${sessionId}/print`, { printerId: effectivePrinterId });
    },
  });

  if (!printingActive || activePrinters.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {activePrinters.length > 1 && (
          <select
            className="h-9 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm"
            value={effectivePrinterId}
            onChange={(event) => setPrinterId(event.target.value)}
          >
            {activePrinters.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.name}
              </option>
            ))}
          </select>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={printSession.isPending}
          onClick={() => printSession.mutate()}
        >
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>
      {printSession.isError && (
        <p className="mt-1 text-xs text-red-600">{extractErrorMessage(printSession.error, "No se pudo enviar a imprimir.")}</p>
      )}
    </div>
  );
}
