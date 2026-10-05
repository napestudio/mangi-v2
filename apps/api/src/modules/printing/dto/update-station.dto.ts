import { IsArray, IsOptional, IsString } from "class-validator";

export class UpdateStationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() color?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}
