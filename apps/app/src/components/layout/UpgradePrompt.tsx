import type { Module } from "@mangiar/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UpgradePromptProps {
  module: Module;
}

export function UpgradePrompt({ module }: UpgradePromptProps) {
  return (
    <Card className="mx-auto mt-12 max-w-md">
      <CardHeader>
        <CardTitle>Módulo no disponible</CardTitle>
        <CardDescription>
          El módulo <span className="font-medium">{module}</span> no está activo para este restaurante.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-500">
          Activá este módulo desde la configuración de suscripción para acceder a esta sección.
        </p>
      </CardContent>
    </Card>
  );
}
