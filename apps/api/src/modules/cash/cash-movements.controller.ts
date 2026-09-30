import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CashMovementsService } from "./cash-movements.service";
import { CreateMovementDto } from "./dto/create-movement.dto";

@ApiTags("cash-movements")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.CASH)
@Controller()
export class CashMovementsController {
  constructor(private readonly cashMovementsService: CashMovementsService) {}

  @Get("cash-sessions/:sessionId/movements")
  findAll(@CurrentUser() user: RequestUser, @Param("sessionId") sessionId: string) {
    return this.cashMovementsService.findAll(requireRestaurantId(user), sessionId);
  }

  @Post("cash-sessions/:sessionId/movements")
  create(@CurrentUser() user: RequestUser, @Param("sessionId") sessionId: string, @Body() dto: CreateMovementDto) {
    return this.cashMovementsService.create(requireRestaurantId(user), sessionId, user.id, dto);
  }
}
