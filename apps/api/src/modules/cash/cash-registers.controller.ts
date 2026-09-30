import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CashRegistersService } from "./cash-registers.service";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

@ApiTags("cash-registers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.CASH)
@Controller("cash-registers")
export class CashRegistersController {
  constructor(private readonly cashRegistersService: CashRegistersService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.cashRegistersService.findAll(requireRestaurantId(user));
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cashRegistersService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCashRegisterDto) {
    return this.cashRegistersService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCashRegisterDto) {
    return this.cashRegistersService.update(requireRestaurantId(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cashRegistersService.remove(requireRestaurantId(user), id);
  }
}
