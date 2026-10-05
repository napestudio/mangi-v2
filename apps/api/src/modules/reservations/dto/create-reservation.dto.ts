import { IsArray, IsDateString, IsEmail, IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateReservationDto {
  @IsString() timeSlotId!: string;

  /** Calendar day the shift/turno belongs to (not necessarily the exact day of `time` for overnight shifts). */
  @IsDateString() businessDate!: string;

  /** Wall-clock time within the turno, in the restaurant's timezone. */
  @IsString() @Matches(TIME_PATTERN) time!: string;

  @IsInt() @Min(1) partySize!: number;

  @IsString() guestName!: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() guestPhone?: string;
  @IsOptional() @IsString() dietaryRestrictions?: string;
  @IsOptional() @IsString() accessibilityNeeds?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() clientId?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) tableIds?: string[];
}
