import type { Module } from "@mangiar/shared";
import { useAuthStore } from "../stores/auth.store";

interface UseModulesResult {
  activeModules: Module[];
  hasModule: (module: Module) => boolean;
}

export function useModules(): UseModulesResult {
  const activeModules = useAuthStore((state) => state.activeModules);
  return {
    activeModules,
    hasModule: (module) => activeModules.includes(module),
  };
}
