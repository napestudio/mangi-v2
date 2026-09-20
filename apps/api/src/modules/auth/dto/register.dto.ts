import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";
import type { RestaurantType } from "@mangiar/shared";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  restaurantName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase alphanumeric with dashes" })
  slug?: string;

  @IsOptional()
  @IsString()
  restaurantType?: RestaurantType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
