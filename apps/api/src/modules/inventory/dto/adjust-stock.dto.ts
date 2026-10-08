import { IsNumber, IsOptional, IsString } from "class-validator";

export class AdjustStockDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() ingredientId?: string;

  /** Relative change — negative to remove stock, positive to add. */
  @IsNumber()
  delta!: number;

  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() attributedToId?: string;
}
