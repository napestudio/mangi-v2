import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class SetStockDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() ingredientId?: string;

  /** Absolute new stock value. */
  @IsNumber()
  @Min(0)
  stock!: number;

  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() attributedToId?: string;
}
