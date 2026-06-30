import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class RegisterExitDto {
  // Partial exit: how many head are leaving. Omit to exit the full occupation.
  @IsOptional()
  @IsInt()
  @Min(1)
  headCount?: number;

  @IsOptional()
  @IsDateString()
  exitedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // If set, registers a matching entry occupation in this other pasture, so the
  // batch's move is tracked on both sides instead of just disappearing from this one.
  @IsOptional()
  @IsUUID()
  destinationPastureId?: string;
}
