import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { InvoicesService } from "./invoices.service";

@ApiTags("invoices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.FISCAL)
@Controller()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get("invoices")
  findAll(@CurrentUser() user: RequestUser) {
    return this.invoicesService.findAll(requireRestaurantId(user));
  }

  @Get("invoices/:id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.invoicesService.findOne(requireRestaurantId(user), id);
  }

  @Post("orders/:id/invoice")
  createForOrder(@CurrentUser() user: RequestUser, @Param("id") orderId: string) {
    return this.invoicesService.createForOrder(requireRestaurantId(user), orderId);
  }
}
