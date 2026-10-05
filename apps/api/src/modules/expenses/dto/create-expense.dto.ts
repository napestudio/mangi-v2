import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ExpenseCategory, PaymentMethodExtended } from "@mangiar/shared";

export class CreateExpenseDto {
  @IsOptional() @IsEnum(ExpenseCategory) category?: ExpenseCategory;

  @IsString()
  description!: string;

  @IsOptional() @IsString() vendor?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional() @IsEnum(PaymentMethodExtended) paidMethod?: PaymentMethodExtended;
  @IsOptional() @IsString() paidById?: string;
  @IsOptional() @IsISO8601() expenseDate?: string;
  @IsOptional() @IsString() receiptUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() paidFromSessionId?: string;
}
