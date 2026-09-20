import type { AuthResponse, Module } from "@mangiar/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { electronStorage } from "../lib/electron-storage";
import { isElectron } from "../lib/platform";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthResponse["user"] | null;
  restaurant: AuthResponse["restaurant"] | null;
  activeModules: Module[];
  setAuth: (auth: AuthResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      restaurant: null,
      activeModules: [],
      setAuth: (auth) =>
        set({
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          user: auth.user,
          restaurant: auth.restaurant,
          activeModules: auth.activeModules,
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearAuth: () =>
        set({ accessToken: null, refreshToken: null, user: null, restaurant: null, activeModules: [] }),
    }),
    {
      name: "mangiar-auth",
      storage: createJSONStorage(() => (isElectron ? electronStorage : localStorage)),
    },
  ),
);
