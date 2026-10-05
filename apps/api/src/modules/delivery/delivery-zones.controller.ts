import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { DeliveryZonesService } from "./delivery-zones.service";
import { CreateDeliveryZoneDto } from "./dto/create-delivery-zone.dto";
import { UpdateDeliveryZoneDto } from "./dto/update-delivery-zone.dto";

@ApiTags("delivery-zones")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.DELIVERY)
@Controller("delivery-zones")
export class DeliveryZonesController {
  constructor(private readonly deliveryZonesService: DeliveryZonesService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.deliveryZonesService.findAll(requireRestaurantId(user));
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDeliveryZoneDto) {
    return this.deliveryZonesService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateDeliveryZoneDto) {
    return this.deliveryZonesService.update(requireRestaurantId(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.deliveryZonesService.remove(requireRestaurantId(user), id);
  }
}
