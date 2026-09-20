import { SetMetadata } from "@nestjs/common";
import type { Module } from "@mangiar/shared";

export const REQUIRES_MODULE_KEY = "requiresModule";
export const RequiresModule = (module: Module): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRES_MODULE_KEY, module);
