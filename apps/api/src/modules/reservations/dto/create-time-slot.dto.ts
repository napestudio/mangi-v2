import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTimeSlotDto {
  @IsOptional() @IsString() name?: string;

  @IsString() @Matches(TIME_PATTERN) startTime!: string;
  @IsString() @Matches(TIME_PATTERN) endTime!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsInt() @Min(1) capacity!: number;

  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(1) turnDurationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) bufferMinutes?: number;
  @IsOptional() @IsInt() @Min(5) slotIntervalMinutes?: number;
}
