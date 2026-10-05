import { Module as NestModule } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ArcaClientFactory } from "./arca-client.factory";
import { FiscalConfigController } from "./fiscal-config.controller";
import { FiscalConfigService } from "./fiscal-config.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@NestModule({
  imports: [PassportModule.register({})],
  controllers: [FiscalConfigController, InvoicesController],
  providers: [FiscalConfigService, InvoicesService, ArcaClientFactory],
  exports: [FiscalConfigService, InvoicesService],
})
export class FiscalModule {}
