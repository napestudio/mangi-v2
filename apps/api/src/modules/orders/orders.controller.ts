import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { AddOrderItemsDto } from "./dto/add-order-items.dto";
import { CheckoutOrderDto } from "./dto/checkout-order.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersDto } from "./dto/list-orders.dto";
import { MoveOrderTableDto } from "./dto/move-order-table.dto";
import { SendToKitchenDto } from "./dto/send-to-kitchen.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: ListOrdersDto) {
    return this.ordersService.findAll(requireRestaurantId(user), query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ordersService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(requireRestaurantId(user), user.id, dto);
  }

  @Patch(":id/status")
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(requireRestaurantId(user), id, dto);
  }

  @Patch(":id/checkout")
  checkout(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CheckoutOrderDto) {
    return this.ordersService.checkout(requireRestaurantId(user), user.id, id, dto);
  }

  @Patch(":id/send-to-kitchen")
  sendToKitchen(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: SendToKitchenDto) {
    return this.ordersService.sendItemsToKitchen(requireRestaurantId(user), id, dto);
  }

  @Post(":id/items")
  addItems(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AddOrderItemsDto) {
    return this.ordersService.addItems(requireRestaurantId(user), id, dto);
  }

  @Delete(":id/items/:itemId")
  removeItem(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.ordersService.removeItem(requireRestaurantId(user), id, itemId);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ordersService.removeEmpty(requireRestaurantId(user), id);
  }

  @Patch(":id/table")
  moveToTable(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: MoveOrderTableDto) {
    return this.ordersService.moveToTable(requireRestaurantId(user), id, dto);
  }
}
