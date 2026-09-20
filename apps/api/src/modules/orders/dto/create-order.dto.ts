import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { DiscountType, OrderType } from "@mangiar/shared";

export class OrderItemModifierDto {
  @IsString()
  optionId!: string;
}

export class CreateOrderItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional() @IsString() notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  modifiers?: OrderItemModifierDto[];
}

export class CreateOrderDto {
  @IsOptional() @IsEnum(OrderType) type?: OrderType;
  @IsOptional() @IsString() tableId?: string;
  @IsOptional() @IsString() clientId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(DiscountType) discountType?: DiscountType;
  @IsOptional() @IsNumber() @Min(0) discountValue?: number;
  @IsOptional() @IsBoolean() needsInvoice?: boolean;
}
