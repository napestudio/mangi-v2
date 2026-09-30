import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsString, ValidateNested } from "class-validator";

export class TimeSlotTableAssignmentDto {
  @IsString() tableId!: string;
  @IsBoolean() exclusive!: boolean;
}

export class AssignTimeSlotTablesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotTableAssignmentDto)
  tables!: TimeSlotTableAssignmentDto[];
}
