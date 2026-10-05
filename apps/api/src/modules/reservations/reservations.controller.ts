import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CheckAvailabilityDto } from "./dto/check-availability.dto";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { ListReservationsDto } from "./dto/list-reservations.dto";
import { UpdateReservationDto } from "./dto/update-reservation.dto";
import { UpdateReservationStatusDto } from "./dto/update-reservation-status.dto";
import { ReservationsService } from "./reservations.service";

@ApiTags("reservations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.RESERVATIONS)
@Controller("reservations")
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: ListReservationsDto) {
    return this.reservationsService.findAll(requireRestaurantId(user), query);
  }

  @Get("availability")
  checkAvailability(@CurrentUser() user: RequestUser, @Query() query: CheckAvailabilityDto) {
    return this.reservationsService.checkAvailability(requireRestaurantId(user), query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.reservationsService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateReservationDto) {
    return this.reservationsService.update(requireRestaurantId(user), id, dto);
  }

  @Patch(":id/status")
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateReservationStatusDto) {
    return this.reservationsService.updateStatus(requireRestaurantId(user), id, dto);
  }
}
