import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { LinkIngredientDto } from "./dto/link-ingredient.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("suppliers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.SUPPLIERS)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.suppliersService.findAll(requireRestaurantId(user));
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliersService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(requireRestaurantId(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliersService.remove(requireRestaurantId(user), id);
  }

  @Post(":id/ingredients")
  linkIngredient(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: LinkIngredientDto) {
    return this.suppliersService.linkIngredient(requireRestaurantId(user), id, dto);
  }

  @Delete(":id/ingredients/:ingredientId")
  unlinkIngredient(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("ingredientId") ingredientId: string) {
    return this.suppliersService.unlinkIngredient(requireRestaurantId(user), id, ingredientId);
  }

  @Post(":id/payments")
  recordPayment(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: RecordPaymentDto) {
    return this.suppliersService.recordPayment(requireRestaurantId(user), id, user.id, dto);
  }
}
