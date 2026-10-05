import { Module as NestModule } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { WebsocketsModule } from "../websockets/websockets.module";
import { PrintersController } from "./printers.controller";
import { PrintersService } from "./printers.service";
import { PrintJobsController } from "./print-jobs.controller";
import { PrintJobsService } from "./print-jobs.service";
import { StationsController } from "./stations.controller";
import { StationsService } from "./stations.service";

@NestModule({
  imports: [PassportModule.register({}), SubscriptionsModule, WebsocketsModule],
  controllers: [StationsController, PrintersController, PrintJobsController],
  providers: [StationsService, PrintersService, PrintJobsService],
  exports: [StationsService, PrintersService, PrintJobsService],
})
export class PrintingModule {}
