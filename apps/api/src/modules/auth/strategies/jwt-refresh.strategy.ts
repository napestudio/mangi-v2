import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type Redis from "ioredis";
import { ExtractJwt, Strategy } from "passport-jwt";
import { REDIS_CLIENT } from "../../../common/redis/redis.module";
import type { RefreshTokenPayload } from "../types";

export interface ValidatedRefreshToken {
  userId: string;
  jti: string;
  exp?: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(
    configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("app.jwt.refreshSecret"),
    });
  }

  async validate(payload: RefreshTokenPayload): Promise<ValidatedRefreshToken> {
    const revoked = await this.redis.get(`revoked:refresh:${payload.jti}`);
    if (revoked) {
      throw new UnauthorizedException("Refresh token has been revoked");
    }
    return { userId: payload.sub, jti: payload.jti, exp: payload.exp };
  }
}
