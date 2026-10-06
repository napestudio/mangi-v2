import { IsString } from "class-validator";

export class MoveOrderTableDto {
  @IsString()
  tableId!: string;
}
