import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { InventoryModule } from "../inventory/inventory.module";
import { PrintingModule } from "../printing/printing.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { WebsocketsModule } from "../websockets/websockets.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PassportModule.register({}), WebsocketsModule, SubscriptionsModule, PrintingModule, InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
