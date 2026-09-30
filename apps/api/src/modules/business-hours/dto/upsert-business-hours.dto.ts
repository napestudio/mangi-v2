import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BusinessHoursRowDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsBoolean() isOpen!: boolean;
  @IsString() @Matches(TIME_PATTERN) openTime!: string;
  @IsString() @Matches(TIME_PATTERN) closeTime!: string;
  @IsOptional() @IsString() label?: string;
}

export class UpsertBusinessHoursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursRowDto)
  rows!: BusinessHoursRowDto[];
}
