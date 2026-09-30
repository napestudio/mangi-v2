import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SalonModule } from "../salon/salon.module";
import { EventsGateway } from "./events.gateway";

@Module({
  imports: [JwtModule.register({}), SalonModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class WebsocketsModule {}
