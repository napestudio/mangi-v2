import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateCashRegisterDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorIds?: string[];
}
