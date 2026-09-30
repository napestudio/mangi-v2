import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { validate } from "./config/env.validation";
import { RedisModule } from "./common/redis/redis.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessHoursModule } from "./modules/business-hours/business-hours.module";
import { CashModule } from "./modules/cash/cash.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { HealthModule } from "./modules/health/health.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { ProductsModule } from "./modules/products/products.module";
import { ReservationsModule } from "./modules/reservations/reservations.module";
import { RestaurantsModule } from "./modules/restaurants/restaurants.module";
import { SalonModule } from "./modules/salon/salon.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { UsersModule } from "./modules/users/users.module";
import { WebsocketsModule } from "./modules/websockets/websockets.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 100 }]),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("app.redisUrl", "redis://localhost:6379");
        const url = new URL(redisUrl);
        return {
          redis: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    BusinessHoursModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    SalonModule,
    CashModule,
    ReservationsModule,
    SuppliersModule,
    SubscriptionsModule,
    WebsocketsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
