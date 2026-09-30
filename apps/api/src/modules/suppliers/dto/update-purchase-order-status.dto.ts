import { IsEnum } from "class-validator";
import { PurchaseOrderStatus } from "@mangiar/shared";

export class UpdatePurchaseOrderStatusDto {
  @IsEnum(PurchaseOrderStatus)
  status!: PurchaseOrderStatus;
}
