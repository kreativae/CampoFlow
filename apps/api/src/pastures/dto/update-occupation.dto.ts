import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// General edit for an existing occupation record (e.g. fixing a wrong exit date
// or headCount after the fact) — distinct from registerExit()'s "close it now" flow.
export class UpdateOccupationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  headCount?: number;

  @IsOptional()
  @IsDateString()
  enteredAt?: string;

  @IsOptional()
  @IsDateString()
  exitedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
