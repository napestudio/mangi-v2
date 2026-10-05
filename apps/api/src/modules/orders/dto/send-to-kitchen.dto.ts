import { IsArray, IsString } from "class-validator";

export class SendToKitchenDto {
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];
}
