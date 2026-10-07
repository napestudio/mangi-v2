import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { OrderStatus } from "@mangiar/shared";

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional() @IsBoolean() restoreStock?: boolean;
  @IsOptional() @IsString() cancelReason?: string;
}
