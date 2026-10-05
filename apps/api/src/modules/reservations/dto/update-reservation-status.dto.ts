import { IsEnum } from "class-validator";
import { ReservationStatus } from "@mangiar/shared";

export class UpdateReservationStatusDto {
  @IsEnum(ReservationStatus)
  status!: ReservationStatus;
}
