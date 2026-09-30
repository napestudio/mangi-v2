import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CreateTableDto } from "./dto/create-table.dto";
import { MoveTableDto } from "./dto/move-table.dto";
import { UpdateTableDto } from "./dto/update-table.dto";
import { UpdateTableStatusDto } from "./dto/update-table-status.dto";
import { TablesService } from "./tables.service";

@ApiTags("tables")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.SALON)
@Controller("tables")
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query("sectorId") sectorId?: string) {
    return this.tablesService.findAll(requireRestaurantId(user), sectorId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tablesService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTableDto) {
    return this.tablesService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(requireRestaurantId(user), id, dto);
  }

  @Patch(":id/position")
  move(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: MoveTableDto) {
    return this.tablesService.move(requireRestaurantId(user), id, dto);
  }

  @Patch(":id/status")
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTableStatusDto) {
    return this.tablesService.updateStatus(requireRestaurantId(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tablesService.remove(requireRestaurantId(user), id);
  }
}
