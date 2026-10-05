import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { SalonModule } from "../salon/salon.module";
import { WebsocketsModule } from "../websockets/websockets.module";
import { ReservationsController } from "./reservations.controller";
import { ReservationsService } from "./reservations.service";
import { TimeSlotsController } from "./time-slots.controller";
import { TimeSlotsService } from "./time-slots.service";

@Module({
  imports: [PassportModule.register({}), SalonModule, WebsocketsModule],
  controllers: [TimeSlotsController, ReservationsController],
  providers: [TimeSlotsService, ReservationsService],
  exports: [TimeSlotsService, ReservationsService],
})
export class ReservationsModule {}
