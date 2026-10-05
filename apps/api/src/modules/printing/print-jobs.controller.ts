import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { requireRestaurantId } from "../../common/require-restaurant-id";
import type { RequestUser } from "../../common/types/request-user.type";
import { UpdatePrintJobStatusDto } from "./dto/update-print-job-status.dto";
import { PrintJobsService } from "./print-jobs.service";

@ApiTags("print-jobs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("print-jobs")
export class PrintJobsController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Get("printer/:printerId")
  findAllForPrinter(@CurrentUser() user: RequestUser, @Param("printerId") printerId: string) {
    return this.printJobsService.findAllForPrinter(requireRestaurantId(user), printerId);
  }

  @Patch(":id/status")
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePrintJobStatusDto) {
    return this.printJobsService.updateStatus(requireRestaurantId(user), id, dto);
  }
}
