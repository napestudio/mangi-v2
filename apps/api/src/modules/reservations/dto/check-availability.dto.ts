import { Transform, Type } from "class-transformer";
import { IsArray, IsDateString, IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CheckAvailabilityDto {
  @IsString() timeSlotId!: string;
  @IsDateString() businessDate!: string;
  @IsString() @Matches(TIME_PATTERN) time!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  partySize!: number;

  @IsOptional() @IsString() excludeReservationId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.split(",").filter(Boolean) : value))
  @IsArray()
  @IsString({ each: true })
  tableIds?: string[];
}
