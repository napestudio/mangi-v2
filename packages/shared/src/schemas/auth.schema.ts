import { z } from "zod";
import { Module, RestaurantType, UserRole } from "../enums";

export const registerPayloadSchema = z.object({
  restaurantName: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with dashes")
    .optional(),
  restaurantType: z.nativeEnum(RestaurantType).optional(),
  name: z.string().optional(),
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterPayload = z.infer<typeof registerPayloadSchema>;

export const loginPayloadSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});
export type LoginPayload = z.infer<typeof loginPayloadSchema>;

export const refreshPayloadSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshPayload = z.infer<typeof refreshPayloadSchema>;

export const logoutPayloadSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutPayload = z.infer<typeof logoutPayloadSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  restaurantId: z.string().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authRestaurantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.nativeEnum(RestaurantType),
});
export type AuthRestaurant = z.infer<typeof authRestaurantSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
  restaurant: authRestaurantSchema,
  activeModules: z.array(z.nativeEnum(Module)),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
