import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class MoveAnimalsDto {
  // Brincos (ids dos animais) a mover de pasto.
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  animalIds: string[];

  // Pasto de destino na mesma propriedade. Omita/null para deixar sem pasto (ex.: confinamento).
  @IsOptional()
  @IsString()
  pastureId?: string | null;
}
