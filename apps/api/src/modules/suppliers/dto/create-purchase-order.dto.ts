import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class PurchaseOrderItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() ingredientId?: string;
  @IsOptional() @IsString() description?: string;

  @IsNumber() @Min(0.001) quantity!: number;
  @IsNumber() @Min(0) unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsString() supplierId!: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}
