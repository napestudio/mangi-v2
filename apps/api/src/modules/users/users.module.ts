import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [PassportModule.register({})],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
