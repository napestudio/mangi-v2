import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { BusinessHoursController } from "./business-hours.controller";
import { BusinessHoursService } from "./business-hours.service";

@Module({
  imports: [PassportModule.register({})],
  controllers: [BusinessHoursController],
  providers: [BusinessHoursService],
  exports: [BusinessHoursService],
})
export class BusinessHoursModule {}
