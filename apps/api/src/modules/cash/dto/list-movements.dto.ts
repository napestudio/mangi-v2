import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";
import { CashMovementType } from "@mangiar/shared";

/** `GET /cash-movements` only ever lists manually-created movements (see cash-movements.service.ts) — SALE
 * (Orders checkout) never reaches this endpoint, so it's not a valid filter value either. */
export class ListMovementsDto {
  @IsOptional() @IsString() cashRegisterId?: string;
  @IsOptional() @IsIn([CashMovementType.INCOME, CashMovementType.EXPENSE]) type?: CashMovementType;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
