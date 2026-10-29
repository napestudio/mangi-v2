import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { PaymentMethodExtended } from "@mangiar/shared";

export class MethodCountDto {
  @IsEnum(PaymentMethodExtended)
  method!: PaymentMethodExtended;

  @IsNumber()
  @Min(0)
  countedAmount!: number;
}

export class CloseSessionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MethodCountDto)
  counts!: MethodCountDto[];

  @IsOptional() @IsString() closedById?: string;
  @IsOptional() @IsString() notes?: string;
}
