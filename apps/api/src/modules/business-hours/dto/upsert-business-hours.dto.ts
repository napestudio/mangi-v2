import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BusinessHoursShiftDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() @Matches(TIME_PATTERN) openTime!: string;
  @IsString() @Matches(TIME_PATTERN) closeTime!: string;
  @IsOptional() @IsString() label?: string;
}

export class UpsertBusinessHoursDto {
  @IsArray()
  @ArrayMaxSize(56)
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursShiftDto)
  shifts!: BusinessHoursShiftDto[];
}
