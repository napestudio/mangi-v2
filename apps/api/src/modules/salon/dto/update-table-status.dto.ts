import { IsEnum } from "class-validator";
import { TableStatus } from "@mangiar/shared";

export class UpdateTableStatusDto {
  @IsEnum(TableStatus)
  status!: TableStatus;
}
