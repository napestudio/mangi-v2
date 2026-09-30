import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CreateSectorDto } from "./dto/create-sector.dto";
import { UpdateSectorDto } from "./dto/update-sector.dto";
import { SectorsService } from "./sectors.service";

@ApiTags("sectors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.SALON)
@Controller("sectors")
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.sectorsService.findAll(requireRestaurantId(user));
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.sectorsService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSectorDto) {
    return this.sectorsService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSectorDto) {
    return this.sectorsService.update(requireRestaurantId(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.sectorsService.remove(requireRestaurantId(user), id);
  }
}
