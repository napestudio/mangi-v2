import { IsArray, IsOptional, IsString } from "class-validator";

export class CreateCashRegisterDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorIds?: string[];
}
