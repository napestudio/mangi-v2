import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateDeliveryConfigDto {
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @IsOptional() @IsNumber() @Min(0) deliveryFee?: number;
  @IsOptional() @IsInt() @Min(1) estimatedMinutes?: number;
  @IsOptional() @IsString() notes?: string;
}
