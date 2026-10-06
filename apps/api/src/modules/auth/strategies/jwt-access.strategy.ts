import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../../prisma/prisma.service";
import type { RequestUser } from "../../../common/types/request-user.type";
import { SubscriptionsService } from "../../subscriptions/subscriptions.service";
import type { AccessTokenPayload } from "../types";

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt-access") {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("app.jwt.accessSecret"),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const activeModules = user.restaurantId ? await this.subscriptionsService.getActiveModules(user.restaurantId) : [];

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as unknown as RequestUser["role"],
      restaurantId: user.restaurantId,
      activeModules,
    };
  }
}
