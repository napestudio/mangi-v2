import { IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateSectorDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsNumber() canvasWidth?: number;
  @IsOptional() @IsNumber() canvasHeight?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}
