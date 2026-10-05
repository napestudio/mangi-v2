import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CreateStationDto } from "./dto/create-station.dto";
import { UpdateStationDto } from "./dto/update-station.dto";
import { StationsService } from "./stations.service";

@ApiTags("stations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.PRINTING)
@Controller("stations")
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.stationsService.findAll(requireRestaurantId(user));
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.stationsService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateStationDto) {
    return this.stationsService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateStationDto) {
    return this.stationsService.update(requireRestaurantId(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.stationsService.remove(requireRestaurantId(user), id);
  }
}
