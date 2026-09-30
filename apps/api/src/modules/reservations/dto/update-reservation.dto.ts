import { IsArray, IsDateString, IsEmail, IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateReservationDto {
  @IsOptional() @IsString() timeSlotId?: string;
  @IsOptional() @IsDateString() businessDate?: string;
  @IsOptional() @IsString() @Matches(TIME_PATTERN) time?: string;
  @IsOptional() @IsInt() @Min(1) partySize?: number;

  @IsOptional() @IsString() guestName?: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() guestPhone?: string;
  @IsOptional() @IsString() dietaryRestrictions?: string;
  @IsOptional() @IsString() accessibilityNeeds?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internalNotes?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) tableIds?: string[];
}
