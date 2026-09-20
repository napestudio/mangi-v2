import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Module } from "@mangiar/shared";
import type { Request } from "express";
import { REQUIRES_MODULE_KEY } from "../decorators/requires-module.decorator";
import type { RequestUser } from "../types/request-user.type";

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModule = this.reflector.getAllAndOverride<Module | undefined>(REQUIRES_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user || !user.activeModules.includes(requiredModule)) {
      throw new ForbiddenException(`Module ${requiredModule} is not active for this restaurant`);
    }
    return true;
  }
}
