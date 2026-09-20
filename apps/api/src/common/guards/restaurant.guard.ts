import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { RequestUser } from "../types/request-user.type";

@Injectable()
export class RestaurantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user?.restaurantId) {
      throw new ForbiddenException("User is not associated with a restaurant");
    }

    const paramRestaurantId = request.params["restaurantId"];
    const bodyRestaurantId = (request.body as { restaurantId?: string } | undefined)?.restaurantId;
    const targetRestaurantId = paramRestaurantId ?? bodyRestaurantId;

    if (targetRestaurantId && targetRestaurantId !== user.restaurantId) {
      throw new ForbiddenException("Resource does not belong to your restaurant");
    }
    return true;
  }
}
