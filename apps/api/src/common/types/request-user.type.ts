import type { Module, UserRole } from "@mangiar/shared";

export interface RequestUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  restaurantId: string | null;
  activeModules: Module[];
}
