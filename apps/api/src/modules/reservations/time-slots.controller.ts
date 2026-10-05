import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { AssignTimeSlotTablesDto } from "./dto/assign-time-slot-tables.dto";
import { CreateTimeSlotDto } from "./dto/create-time-slot.dto";
import { UpdateTimeSlotDto } from "./dto/update-time-slot.dto";
import { TimeSlotsService } from "./time-slots.service";

@ApiTags("time-slots")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.RESERVATIONS)
@Controller("time-slots")
export class TimeSlotsController {
  constructor(private readonly timeSlotsService: TimeSlotsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.timeSlotsService.findAll(requireRestaurantId(user));
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.timeSlotsService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTimeSlotDto) {
    return this.timeSlotsService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTimeSlotDto) {
    return this.timeSlotsService.update(requireRestaurantId(user), id, dto);
  }

  @Put(":id/tables")
  assignTables(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AssignTimeSlotTablesDto) {
    return this.timeSlotsService.assignTables(requireRestaurantId(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.timeSlotsService.remove(requireRestaurantId(user), id);
  }
}
