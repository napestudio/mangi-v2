import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class RemoveOrderItemQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  restoreStock?: boolean;
}
