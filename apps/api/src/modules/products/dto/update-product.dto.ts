import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from "class-validator";
import { ProductTag, UnitType, VolumeUnit, WeightUnit } from "@mangiar/shared";
import { ProductPriceDto } from "./create-product.dto";

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl() image?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsEnum(UnitType) unitType?: UnitType;
  @IsOptional() @IsEnum(WeightUnit) weightUnit?: WeightUnit;
  @IsOptional() @IsEnum(VolumeUnit) volumeUnit?: VolumeUnit;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isCombo?: boolean;
  @IsOptional() @IsBoolean() trackStock?: boolean;
  @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @IsNumber() @Min(0) maxStock?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(ProductTag, { each: true })
  tags?: ProductTag[];

  @IsOptional() @IsInt() sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPriceDto)
  prices?: ProductPriceDto[];
}
