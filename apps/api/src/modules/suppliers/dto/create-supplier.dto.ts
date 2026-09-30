import { IsEmail, IsOptional, IsString } from "class-validator";

export class CreateSupplierDto {
  @IsString() name!: string;

  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() taxId?: string;
  @IsOptional() @IsString() notes?: string;
}
