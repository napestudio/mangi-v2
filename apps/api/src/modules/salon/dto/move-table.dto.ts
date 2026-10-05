import { IsNumber, IsOptional } from "class-validator";

export class MoveTableDto {
  @IsNumber()
  posX!: number;

  @IsNumber()
  posY!: number;

  @IsOptional() @IsNumber() rotation?: number;
}
