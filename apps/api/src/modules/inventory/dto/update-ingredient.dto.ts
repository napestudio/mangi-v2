import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { UnitType, VolumeUnit, WeightUnit } from "@mangiar/shared";

export class UpdateIngredientDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(UnitType) unitType?: UnitType;
  @IsOptional() @IsEnum(WeightUnit) weightUnit?: WeightUnit;
  @IsOptional() @IsEnum(VolumeUnit) volumeUnit?: VolumeUnit;
  @IsOptional() @IsNumber() @Min(0) costPerUnit?: number;
  @IsOptional() @IsNumber() @Min(0) minStock?: number;
}
