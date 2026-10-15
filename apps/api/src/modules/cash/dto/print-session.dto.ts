import { IsString } from "class-validator";

export class PrintSessionDto {
  @IsString()
  printerId!: string;
}
