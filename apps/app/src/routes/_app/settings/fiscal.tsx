import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";

interface FiscalConfigData {
  id: string;
  cuit: string;
  businessName: string;
  salesPointNumber: number;
  issuerCondition: "responsable_inscripto" | "monotributo" | "exento" | "no_alcanzado";
  environment: "testing" | "production";
  autoIssue: boolean;
  hasCertificate: boolean;
  hasPrivateKey: boolean;
}

const ISSUER_CONDITION_LABELS: Record<FiscalConfigData["issuerCondition"], string> = {
  responsable_inscripto: "Responsable Inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  no_alcanzado: "No alcanzado",
};

interface FormState {
  cuit: string;
  businessName: string;
  certificate: string;
  privateKey: string;
  salesPointNumber: string;
  issuerCondition: FiscalConfigData["issuerCondition"];
  environment: FiscalConfigData["environment"];
}

function emptyForm(): FormState {
  return {
    cuit: "",
    businessName: "",
    certificate: "",
    privateKey: "",
    salesPointNumber: "",
    issuerCondition: "monotributo",
    environment: "testing",
  };
}

export const Route = createFileRoute("/_app/settings/fiscal")({
  component: FiscalSettingsPage,
});

function FiscalSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());

  const { data: config, isLoading } = useQuery({
    queryKey: ["fiscal-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<FiscalConfigData | null>>("/fiscal-config");
      return data.data;
    },
  });

  useEffect(() => {
    if (!config) return;
    setForm((prev) => ({
      ...prev,
      cuit: config.cuit,
      businessName: config.businessName,
      salesPointNumber: String(config.salesPointNumber),
      issuerCondition: config.issuerCondition,
      environment: config.environment,
    }));
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      await apiClient.put("/fiscal-config", {
        cuit: form.cuit,
        businessName: form.businessName,
        certificate: form.certificate || undefined,
        privateKey: form.privateKey || undefined,
        salesPointNumber: Number(form.salesPointNumber),
        issuerCondition: form.issuerCondition,
        environment: form.environment,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fiscal-config"] });
      setForm((prev) => ({ ...prev, certificate: "", privateKey: "" }));
    },
  });

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Cargando...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Facturación electrónica (AFIP/ARCA)</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cuit">CUIT</Label>
            <Input id="cuit" value={form.cuit} onChange={(event) => setForm((prev) => ({ ...prev, cuit: event.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">Razón social</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="salesPointNumber">Punto de venta</Label>
            <Input
              id="salesPointNumber"
              type="number"
              min={1}
              value={form.salesPointNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, salesPointNumber: event.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issuerCondition">Condición frente al IVA</Label>
            <select
              id="issuerCondition"
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
              value={form.issuerCondition}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, issuerCondition: event.target.value as FiscalConfigData["issuerCondition"] }))
              }
            >
              {Object.entries(ISSUER_CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="environment">Entorno</Label>
            <select
              id="environment"
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
              value={form.environment}
              onChange={(event) => setForm((prev) => ({ ...prev, environment: event.target.value as FiscalConfigData["environment"] }))}
            >
              <option value="testing">Testing (homologación)</option>
              <option value="production">Producción</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="certificate">
            Certificado (PEM) {config?.hasCertificate && <span className="text-emerald-600">· ya configurado</span>}
          </Label>
          <textarea
            id="certificate"
            rows={4}
            placeholder={config?.hasCertificate ? "Dejar en blanco para mantener el certificado actual" : "-----BEGIN CERTIFICATE-----"}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-mono"
            value={form.certificate}
            onChange={(event) => setForm((prev) => ({ ...prev, certificate: event.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="privateKey">
            Clave privada (PEM) {config?.hasPrivateKey && <span className="text-emerald-600">· ya configurada</span>}
          </Label>
          <textarea
            id="privateKey"
            rows={4}
            placeholder={config?.hasPrivateKey ? "Dejar en blanco para mantener la clave actual" : "-----BEGIN PRIVATE KEY-----"}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-mono"
            value={form.privateKey}
            onChange={(event) => setForm((prev) => ({ ...prev, privateKey: event.target.value }))}
          />
        </div>

        <p className="text-xs text-neutral-500">
          El certificado y la clave privada se usan para autenticar contra AFIP/ARCA (WSAA) y nunca se muestran de nuevo una vez
          guardados.
        </p>

        {save.isError && <p className="text-sm text-red-600">No se pudo guardar la configuración.</p>}
        <Button
          className="w-fit"
          disabled={!form.cuit || !form.businessName || !form.salesPointNumber || save.isPending}
          onClick={() => save.mutate()}
        >
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
