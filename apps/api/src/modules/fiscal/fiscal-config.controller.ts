import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { UpdateFiscalConfigDto } from "./dto/update-fiscal-config.dto";
import { FiscalConfigService } from "./fiscal-config.service";

@ApiTags("fiscal-config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.FISCAL)
@Controller("fiscal-config")
export class FiscalConfigController {
  constructor(private readonly fiscalConfigService: FiscalConfigService) {}

  @Get()
  findMine(@CurrentUser() user: RequestUser) {
    return this.fiscalConfigService.findMine(requireRestaurantId(user));
  }

  @Put()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateFiscalConfigDto) {
    return this.fiscalConfigService.update(requireRestaurantId(user), dto);
  }
}
