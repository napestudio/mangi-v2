import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { SectorsController } from "./sectors.controller";
import { SectorsService } from "./sectors.service";
import { TablesController } from "./tables.controller";
import { TablesService } from "./tables.service";

@Module({
  imports: [PassportModule.register({})],
  controllers: [SectorsController, TablesController],
  providers: [SectorsService, TablesService],
  exports: [SectorsService, TablesService],
})
export class SalonModule {}
