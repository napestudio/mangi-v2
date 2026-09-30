import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { UpdatePurchaseOrderStatusDto } from "./dto/update-purchase-order-status.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

@ApiTags("purchase-orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.SUPPLIERS)
@Controller("purchase-orders")
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.purchaseOrdersService.findAll(requireRestaurantId(user));
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.purchaseOrdersService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id/status")
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePurchaseOrderStatusDto) {
    return this.purchaseOrdersService.updateStatus(requireRestaurantId(user), id, user.id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.purchaseOrdersService.remove(requireRestaurantId(user), id);
  }
}
