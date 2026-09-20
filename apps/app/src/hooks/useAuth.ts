import type { AuthResponse, LoginPayload, RegisterPayload } from "@mangiar/shared";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { apiClient, type ApiEnvelope } from "../lib/api-client";
import { useAuthStore } from "../stores/auth.store";

export function useLogin(): UseMutationResult<AuthResponse, Error, LoginPayload> {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>("/auth/login", payload);
      return data.data;
    },
    onSuccess: setAuth,
  });
}

export function useRegister(): UseMutationResult<AuthResponse, Error, RegisterPayload> {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>("/auth/register", payload);
      return data.data;
    },
    onSuccess: setAuth,
  });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await apiClient.post("/auth/logout", { refreshToken });
      }
    },
    onSettled: () => clearAuth(),
  });
}

interface CurrentUser {
  user: AuthResponse["user"] | null;
  restaurant: AuthResponse["restaurant"] | null;
  isAuthenticated: boolean;
}

export function useCurrentUser(): CurrentUser {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      restaurant: state.restaurant,
      isAuthenticated: Boolean(state.accessToken),
    })),
  );
}
