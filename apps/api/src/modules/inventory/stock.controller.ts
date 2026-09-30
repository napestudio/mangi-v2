import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { ListStockMovementsDto } from "./dto/list-stock-movements.dto";
import { SetStockDto } from "./dto/set-stock.dto";
import { StockService } from "./stock.service";

@ApiTags("stock")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.INVENTORY)
@Controller("stock")
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get("movements")
  findMovements(@CurrentUser() user: RequestUser, @Query() query: ListStockMovementsDto) {
    return this.stockService.findMovements(requireRestaurantId(user), query);
  }

  @Post("adjust")
  adjust(@CurrentUser() user: RequestUser, @Body() dto: AdjustStockDto) {
    return this.stockService.adjust(requireRestaurantId(user), user.id, dto);
  }

  @Post("set")
  set(@CurrentUser() user: RequestUser, @Body() dto: SetStockDto) {
    return this.stockService.set(requireRestaurantId(user), user.id, dto);
  }
}
