import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { InventoryModule } from "../inventory/inventory.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [PassportModule.register({}), InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
