import { IsEnum, IsOptional, IsString } from "class-validator";
import { PrintJobStatus } from "@mangiar/shared";

export class UpdatePrintJobStatusDto {
  @IsEnum(PrintJobStatus)
  status!: PrintJobStatus;

  @IsOptional() @IsString() errorMessage?: string;
}
