import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentMethodExtended } from "@mangiar/shared";

export class CheckoutOrderDto {
  @IsEnum(PaymentMethodExtended)
  paymentMethodExt!: PaymentMethodExtended;

  @IsOptional() @IsString() sessionId?: string;
}
