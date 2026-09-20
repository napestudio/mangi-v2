import { z } from "zod";
import { RestaurantType } from "../enums";

export const createRestaurantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  type: z.nativeEnum(RestaurantType).default(RestaurantType.RESTAURANT),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().default("America/Argentina/Buenos_Aires"),
  currency: z.string().default("ARS"),
});
export type CreateRestaurantPayload = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = z.object({
  name: z.string().min(2).optional(),
  logo: z.string().url().optional(),
  coverImage: z.string().url().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  website: z.string().url().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  notificationEmail: z.string().email().optional(),
  printerServerUrl: z.string().url().optional(),
});
export type UpdateRestaurantPayload = z.infer<typeof updateRestaurantSchema>;
