import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { PrinterConnectionType, PrintMode } from "@mangiar/shared";

export class UpdatePrinterDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(PrinterConnectionType) connectionType?: PrinterConnectionType;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsInt() @Min(1) port?: number;
  @IsOptional() @IsString() usbPath?: string;
  @IsOptional() @IsInt() @Min(1) paperWidth?: number;
  @IsOptional() @IsEnum(PrintMode) printMode?: PrintMode;
  @IsOptional() @IsString() headerText?: string;
  @IsOptional() @IsString() footerText?: string;
  @IsOptional() @IsInt() @Min(1) copies?: number;
  @IsOptional() @IsString() stationId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
