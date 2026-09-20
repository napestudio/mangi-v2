import { IsEnum } from "class-validator";
import { OrderStatus } from "@mangiar/shared";

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
