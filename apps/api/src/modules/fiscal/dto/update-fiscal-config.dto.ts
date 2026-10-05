import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

const ISSUER_CONDITIONS = ["responsable_inscripto", "monotributo", "exento", "no_alcanzado"] as const;
const ENVIRONMENTS = ["testing", "production"] as const;

export class UpdateFiscalConfigDto {
  @IsOptional() @IsString() cuit?: string;
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() certificate?: string;
  @IsOptional() @IsString() privateKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  salesPointNumber?: number;

  @IsOptional() @IsIn(ISSUER_CONDITIONS) issuerCondition?: (typeof ISSUER_CONDITIONS)[number];
  @IsOptional() @IsIn(ENVIRONMENTS) environment?: (typeof ENVIRONMENTS)[number];
  @IsOptional() @IsBoolean() autoIssue?: boolean;
}
