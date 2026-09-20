import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import type { ValidatedRefreshToken } from "./strategies/jwt-refresh.strategy";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post("refresh")
  refresh(@Req() req: Request & { user: ValidatedRefreshToken }, @Body() _dto: RefreshDto) {
    return this.authService.refresh(req.user);
  }

  @UseGuards(JwtRefreshGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() req: Request & { user: ValidatedRefreshToken }, @Body() _dto: RefreshDto) {
    return this.authService.logout(req.user);
  }
}
