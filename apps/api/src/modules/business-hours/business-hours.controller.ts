import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { BusinessHoursService } from "./business-hours.service";
import { UpsertBusinessHoursDto } from "./dto/upsert-business-hours.dto";

@ApiTags("business-hours")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("business-hours")
export class BusinessHoursController {
  constructor(private readonly businessHoursService: BusinessHoursService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.businessHoursService.findAll(requireRestaurantId(user));
  }

  @Get("status")
  getStatus(@CurrentUser() user: RequestUser) {
    return this.businessHoursService.getStatus(requireRestaurantId(user));
  }

  @Put()
  upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertBusinessHoursDto) {
    return this.businessHoursService.upsert(requireRestaurantId(user), dto);
  }
}
