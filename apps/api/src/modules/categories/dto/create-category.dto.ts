import { IsBoolean, IsInt, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl() image?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
