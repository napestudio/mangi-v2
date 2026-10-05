import { IsDateString, IsOptional } from "class-validator";

export class ListReservationsDto {
  /** Business-date range (YYYY-MM-DD), inclusive — groups overnight shifts under the day they started. */
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
