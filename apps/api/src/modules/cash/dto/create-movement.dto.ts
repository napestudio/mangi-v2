import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CashMovementType, PaymentMethodExtended } from "@mangiar/shared";

export class CreateMovementDto {
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsOptional() @IsEnum(PaymentMethodExtended) method?: PaymentMethodExtended;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() createdById?: string;
}
