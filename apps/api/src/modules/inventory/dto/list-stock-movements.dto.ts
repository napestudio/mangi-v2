import { IsOptional, IsString } from "class-validator";

export class ListStockMovementsDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() ingredientId?: string;
}
