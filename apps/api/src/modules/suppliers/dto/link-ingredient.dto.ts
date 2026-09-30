import { IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class LinkIngredientDto {
  @IsString() ingredientId!: string;

  @IsOptional() @IsString() supplierSku?: string;
  @IsOptional() @IsNumber() @Min(0) lastCost?: number;
  @IsOptional() @IsBoolean() isPreferred?: boolean;
}
