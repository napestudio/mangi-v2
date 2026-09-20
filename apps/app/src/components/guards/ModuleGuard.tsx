import type { Module } from "@mangiar/shared";
import type { ReactNode } from "react";
import { UpgradePrompt } from "@/components/layout/UpgradePrompt";
import { useModules } from "@/hooks/useModules";

interface ModuleGuardProps {
  module: Module;
  children: ReactNode;
}

export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { hasModule } = useModules();
  if (!hasModule(module)) {
    return <UpgradePrompt module={module} />;
  }
  return <>{children}</>;
}
