import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateOccupationDto {
  @IsInt()
  @Min(1)
  headCount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
