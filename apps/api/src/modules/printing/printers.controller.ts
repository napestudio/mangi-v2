import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { Module } from "@mangiar/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresModule } from "../../common/decorators/requires-module.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ModuleGuard } from "../../common/guards/module.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { CreatePrinterDto } from "./dto/create-printer.dto";
import { UpdatePrinterDto } from "./dto/update-printer.dto";
import { PrintersService } from "./printers.service";

class UpdatePrinterHeartbeatDto {
  @IsIn(["ONLINE", "OFFLINE", "ERROR"])
  status!: "ONLINE" | "OFFLINE" | "ERROR";
}

@ApiTags("printers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule(Module.PRINTING)
@Controller("printers")
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.printersService.findAll(requireRestaurantId(user));
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.printersService.findOne(requireRestaurantId(user), id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePrinterDto) {
    return this.printersService.create(requireRestaurantId(user), dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePrinterDto) {
    return this.printersService.update(requireRestaurantId(user), id, dto);
  }

  @Patch(":id/status")
  updateHeartbeat(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePrinterHeartbeatDto) {
    return this.printersService.updateHeartbeat(requireRestaurantId(user), id, dto.status);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.printersService.remove(requireRestaurantId(user), id);
  }
}
