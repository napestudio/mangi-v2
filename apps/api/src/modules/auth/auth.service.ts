import { randomUUID } from "node:crypto";
import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import type { AuthResponse } from "@mangiar/shared";
import * as bcrypt from "bcrypt";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import type {
  Restaurant as PrismaRestaurant,
  RestaurantType as PrismaRestaurantType,
  User as PrismaUser,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import type { ValidatedRefreshToken } from "./strategies/jwt-refresh.strategy";
import type { RegisterDto } from "./dto/register.dto";
import type { LoginDto } from "./dto/login.dto";
import type { AccessTokenPayload, RefreshTokenPayload } from "./types";

const REFRESH_TOKEN_FALLBACK_TTL_SECONDS = 60 * 60 * 24 * 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const slug = dto.slug ?? this.slugify(dto.restaurantName);

    const [existingSlug, existingUsername, existingEmail] = await Promise.all([
      this.prisma.restaurant.findUnique({ where: { slug } }),
      this.prisma.user.findUnique({ where: { username: dto.username } }),
      this.prisma.user.findUnique({ where: { email: dto.email } }),
    ]);
    if (existingSlug) throw new ConflictException("Restaurant slug already in use");
    if (existingUsername) throw new ConflictException("Username already in use");
    if (existingEmail) throw new ConflictException("Email already in use");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const { user, restaurant } = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: dto.restaurantName,
          slug,
          type: dto.restaurantType as unknown as PrismaRestaurantType | undefined,
        },
      });

      const user = await tx.user.create({
        data: {
          name: dto.name,
          username: dto.username,
          email: dto.email,
          password: passwordHash,
          role: "ADMIN",
          restaurantId: restaurant.id,
        },
      });

      await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          module: "CORE",
          status: "TRIAL",
          trialEndsAt,
        },
      });

      return { user, restaurant };
    });

    return this.buildAuthResponse(user, restaurant);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.usernameOrEmail }, { email: dto.usernameOrEmail }] },
      include: { restaurant: true },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (!user.restaurant) {
      throw new UnauthorizedException("User has no restaurant");
    }

    return this.buildAuthResponse(user, user.restaurant);
  }

  async refresh(refreshPayload: ValidatedRefreshToken): Promise<{ accessToken: string; refreshToken: string }> {
    await this.revokeRefreshToken(refreshPayload.jti, refreshPayload.exp);

    const user = await this.prisma.user.findUnique({ where: { id: refreshPayload.userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id),
      this.signRefreshToken(user.id),
    ]);
    return { accessToken, refreshToken };
  }

  async logout(refreshPayload: ValidatedRefreshToken): Promise<void> {
    await this.revokeRefreshToken(refreshPayload.jti, refreshPayload.exp);
  }

  private async buildAuthResponse(user: PrismaUser, restaurant: PrismaRestaurant): Promise<AuthResponse> {
    const activeModules = await this.subscriptionsService.getActiveModules(restaurant.id);
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id),
      this.signRefreshToken(user.id),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role as unknown as AuthResponse["user"]["role"],
        restaurantId: user.restaurantId,
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        type: restaurant.type as unknown as AuthResponse["restaurant"]["type"],
      },
      activeModules,
    };
  }

  private async signAccessToken(userId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, type: "access" };
    const expiresIn = this.configService.get<string>("app.jwt.accessExpires", "15m");
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("app.jwt.accessSecret"),
      expiresIn: expiresIn as unknown as NonNullable<JwtSignOptions["expiresIn"]>,
    });
  }

  private async signRefreshToken(userId: string): Promise<string> {
    const payload: RefreshTokenPayload = { sub: userId, jti: randomUUID(), type: "refresh" };
    const expiresIn = this.configService.get<string>("app.jwt.refreshExpires", "30d");
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("app.jwt.refreshSecret"),
      expiresIn: expiresIn as unknown as NonNullable<JwtSignOptions["expiresIn"]>,
    });
  }

  private async revokeRefreshToken(jti: string, exp?: number): Promise<void> {
    const ttlSeconds = exp ? Math.max(exp - Math.floor(Date.now() / 1000), 1) : REFRESH_TOKEN_FALLBACK_TTL_SECONDS;
    await this.redis.set(`revoked:refresh:${jti}`, "1", "EX", ttlSeconds);
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
}
