import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { DeliveryZoneType } from "@mangiar/shared";

export class CreateDeliveryZoneDto {
  @IsString() name!: string;

  @IsOptional() @IsEnum(DeliveryZoneType) type?: DeliveryZoneType;
  @IsOptional() @IsNumber() @Min(0) minRadiusMeters?: number;
  @IsOptional() @IsNumber() @Min(0) maxRadiusMeters?: number;

  @IsNumber()
  @Min(0)
  fee!: number;

  @IsOptional() @IsInt() @Min(1) estimatedMinutes?: number;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
