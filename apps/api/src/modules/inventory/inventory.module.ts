import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { IngredientsController } from "./ingredients.controller";
import { IngredientsService } from "./ingredients.service";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";

@Module({
  imports: [PassportModule.register({})],
  controllers: [IngredientsController, StockController],
  providers: [IngredientsService, StockService],
  exports: [IngredientsService, StockService],
})
export class InventoryModule {}
