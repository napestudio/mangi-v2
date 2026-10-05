import { Module as NestModule } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

@NestModule({
  imports: [PassportModule.register({})],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
