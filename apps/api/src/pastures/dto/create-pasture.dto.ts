import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePastureDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsNumber()
  @Min(0.01)
  areaHectares: number;

  @IsOptional()
  @IsString()
  grassType?: string;

  @IsInt()
  @Min(1)
  animalCapacity: number;
}
