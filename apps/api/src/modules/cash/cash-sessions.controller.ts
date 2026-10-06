import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module, UserRole } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CashSessionsService } from "./cash-sessions.service";
import { CloseSessionDto } from "./dto/close-session.dto";
import { OpenSessionDto } from "./dto/open-session.dto";

@ApiTags("cash-sessions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.CASH)
@Controller()
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Get("cash-registers/:cashRegisterId/sessions")
  findAllForRegister(@CurrentUser() user: RequestUser, @Param("cashRegisterId") cashRegisterId: string) {
    return this.cashSessionsService.findAllForRegister(requireRestaurantId(user), cashRegisterId);
  }

  @Post("cash-registers/:cashRegisterId/sessions")
  open(@CurrentUser() user: RequestUser, @Param("cashRegisterId") cashRegisterId: string, @Body() dto: OpenSessionDto) {
    return this.cashSessionsService.open(requireRestaurantId(user), cashRegisterId, user.id, dto);
  }

  @Get("cash-sessions/:id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cashSessionsService.findOne(requireRestaurantId(user), id);
  }

  @Patch("cash-sessions/:id/close")
  close(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CloseSessionDto) {
    return this.cashSessionsService.close(requireRestaurantId(user), id, user.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch("cash-sessions/:id/reopen")
  reopen(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.cashSessionsService.reopen(requireRestaurantId(user), id, user.id);
  }
}
