import { Module as NestModule } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { DeliveryConfigController } from "./delivery-config.controller";
import { DeliveryConfigService } from "./delivery-config.service";
import { DeliveryZonesController } from "./delivery-zones.controller";
import { DeliveryZonesService } from "./delivery-zones.service";

@NestModule({
  imports: [PassportModule.register({})],
  controllers: [DeliveryConfigController, DeliveryZonesController],
  providers: [DeliveryConfigService, DeliveryZonesService],
  exports: [DeliveryConfigService, DeliveryZonesService],
})
export class DeliveryModule {}
