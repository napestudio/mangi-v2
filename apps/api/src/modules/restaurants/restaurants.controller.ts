import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { UpdateRestaurantDto } from "./dto/update-restaurant.dto";
import { RestaurantsService } from "./restaurants.service";

@ApiTags("restaurants")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("restaurants")
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get("me")
  findMine(@CurrentUser() user: RequestUser) {
    return this.restaurantsService.findById(requireRestaurantId(user));
  }

  @Patch("me")
  updateMine(@CurrentUser() user: RequestUser, @Body() dto: UpdateRestaurantDto) {
    return this.restaurantsService.update(requireRestaurantId(user), dto);
  }
}
