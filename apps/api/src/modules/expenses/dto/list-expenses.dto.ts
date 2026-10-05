import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { ExpenseCategory } from "@mangiar/shared";

export class ListExpensesDto {
  @IsOptional() @IsEnum(ExpenseCategory) category?: ExpenseCategory;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
