import { Module } from "@mangiar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SidePanel, useSidePanel } from "@/components/ui/side-panel";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface InvoiceItem {
  id: string;
  orderId: string | null;
  status: "PENDING" | "EMITTED" | "CANCELLED" | "FAILED";
  invoiceType: string;
  invoiceNumber: number;
  salesPoint: number;
  cae: string | null;
  caeExpiry: string | null;
  subtotal: string;
  vatAmount: string;
  total: string;
  clientName: string | null;
  clientTaxId: string | null;
  qrData: string | null;
  arcaResponse: unknown;
  issuedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<InvoiceItem["status"], string> = {
  PENDING: "Pendiente",
  EMITTED: "Emitida",
  CANCELLED: "Cancelada",
  FAILED: "Falló",
};

const STATUS_STYLES: Record<InvoiceItem["status"], string> = {
  PENDING: "bg-neutral-200 text-neutral-700",
  EMITTED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-neutral-200 text-neutral-700",
  FAILED: "bg-red-100 text-red-700",
};

export const Route = createFileRoute("/_app/invoices/")({
  component: () => (
    <ModuleGuard module={Module.FISCAL}>
      <InvoicesPage />
    </ModuleGuard>
  ),
});

const columns: ColumnDef<InvoiceItem>[] = [
  { id: "date", header: "Fecha", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString("es-AR") },
  { id: "type", header: "Tipo", cell: ({ row }) => `Factura ${row.original.invoiceType}` },
  { id: "number", header: "Número", cell: ({ row }) => `${row.original.salesPoint}-${String(row.original.invoiceNumber).padStart(8, "0")}` },
  { id: "client", header: "Cliente", cell: ({ row }) => row.original.clientName ?? "Consumidor final" },
  { id: "total", header: "Total", cell: ({ row }) => formatPrice(row.original.total) },
  {
    id: "status",
    header: "Estado",
    cell: ({ row }) => (
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[row.original.status])}>
        {STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
];

function InvoicesPage() {
  const queryClient = useQueryClient();
  const panel = useSidePanel<InvoiceItem>();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<InvoiceItem[]>>("/invoices");
      return data.data;
    },
  });

  const retry = useMutation({
    mutationFn: async () => {
      if (!panel.selected?.orderId) return;
      await apiClient.post(`/orders/${panel.selected.orderId}/invoice`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      panel.close();
    },
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Facturas</h1>

      <DataTable
        columns={columns}
        data={invoices ?? []}
        isLoading={isLoading}
        onRowClick={panel.open}
        emptyMessage="No hay facturas emitidas todavía."
        className="flex-1"
      />

      <SidePanel
        open={panel.isOpen}
        onClose={panel.close}
        title={panel.selected ? `Factura ${panel.selected.invoiceType} ${panel.selected.salesPoint}-${panel.selected.invoiceNumber}` : ""}
      >
        {panel.selected && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium uppercase text-neutral-500">Estado</p>
              <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[panel.selected.status])}>
                {STATUS_LABELS[panel.selected.status]}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Cliente</dt>
                <dd className="text-neutral-900">{panel.selected.clientName ?? "Consumidor final"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">CUIT/DNI cliente</dt>
                <dd className="text-neutral-900">{panel.selected.clientTaxId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Subtotal</dt>
                <dd className="text-neutral-900">{formatPrice(panel.selected.subtotal)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">IVA</dt>
                <dd className="text-neutral-900">{formatPrice(panel.selected.vatAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Total</dt>
                <dd className="font-semibold text-neutral-900">{formatPrice(panel.selected.total)}</dd>
              </div>
              {panel.selected.cae && (
                <div>
                  <dt className="text-xs font-medium uppercase text-neutral-500">CAE</dt>
                  <dd className="text-neutral-900">{panel.selected.cae}</dd>
                </div>
              )}
              {panel.selected.caeExpiry && (
                <div>
                  <dt className="text-xs font-medium uppercase text-neutral-500">Vencimiento CAE</dt>
                  <dd className="text-neutral-900">{new Date(panel.selected.caeExpiry).toLocaleDateString("es-AR")}</dd>
                </div>
              )}
            </dl>

            {panel.selected.qrData && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-neutral-500">QR</p>
                <a href={panel.selected.qrData} target="_blank" rel="noreferrer" className="break-all text-sm text-sky-700 underline">
                  {panel.selected.qrData}
                </a>
              </div>
            )}

            {panel.selected.status === "FAILED" && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-neutral-500">Detalle del error</p>
                <pre className="max-h-48 overflow-auto rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
                  {JSON.stringify(panel.selected.arcaResponse, null, 2)}
                </pre>
                {panel.selected.orderId && (
                  <Button size="sm" className="mt-3" disabled={retry.isPending} onClick={() => retry.mutate()}>
                    Reintentar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
