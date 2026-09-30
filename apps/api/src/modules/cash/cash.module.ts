import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { CashMovementsController } from "./cash-movements.controller";
import { CashMovementsService } from "./cash-movements.service";
import { CashRegistersController } from "./cash-registers.controller";
import { CashRegistersService } from "./cash-registers.service";
import { CashSessionsController } from "./cash-sessions.controller";
import { CashSessionsService } from "./cash-sessions.service";

@Module({
  imports: [PassportModule.register({})],
  controllers: [CashRegistersController, CashSessionsController, CashMovementsController],
  providers: [CashRegistersService, CashSessionsService, CashMovementsService],
  exports: [CashRegistersService, CashSessionsService, CashMovementsService],
})
export class CashModule {}
