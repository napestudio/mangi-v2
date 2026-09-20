import { ForbiddenException } from "@nestjs/common";
import type { RequestUser } from "./types/request-user.type";

export function requireRestaurantId(user: RequestUser): string {
  if (!user.restaurantId) {
    throw new ForbiddenException("User is not associated with a restaurant");
  }
  return user.restaurantId;
}
