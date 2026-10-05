import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ListExpensesDto } from "./dto/list-expenses.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { ExpensesService } from "./expenses.service";

@ApiTags("expenses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.EXPENSES)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: ListExpensesDto) {
    return this.expensesService.findAll(requireRestaurantId(user), query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.expensesService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(requireRestaurantId(user), user.id, user.activeModules, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(requireRestaurantId(user), user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.expensesService.remove(requireRestaurantId(user), user.id, id);
  }
}
