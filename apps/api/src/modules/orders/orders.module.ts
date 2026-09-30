import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { WebsocketsModule } from "../websockets/websockets.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PassportModule.register({}), WebsocketsModule, SubscriptionsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
