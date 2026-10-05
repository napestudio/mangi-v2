import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { DeliveryConfigService } from "./delivery-config.service";
import { UpdateDeliveryConfigDto } from "./dto/update-delivery-config.dto";

@ApiTags("delivery-config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.DELIVERY)
@Controller("delivery-config")
export class DeliveryConfigController {
  constructor(private readonly deliveryConfigService: DeliveryConfigService) {}

  @Get()
  findMine(@CurrentUser() user: RequestUser) {
    return this.deliveryConfigService.findOrCreate(requireRestaurantId(user));
  }

  @Put()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateDeliveryConfigDto) {
    return this.deliveryConfigService.update(requireRestaurantId(user), dto);
  }
}
