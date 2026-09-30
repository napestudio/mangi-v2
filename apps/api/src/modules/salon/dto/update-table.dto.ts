import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TableShape } from "@mangiar/shared";

export class UpdateTableDto {
  @IsOptional() @IsString() sectorId?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsEnum(TableShape) shape?: TableShape;
  @IsOptional() @IsNumber() posX?: number;
  @IsOptional() @IsNumber() posY?: number;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsNumber() rotation?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
