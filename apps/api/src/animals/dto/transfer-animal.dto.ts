import { IsOptional, IsString } from 'class-validator';

export class TransferAnimalDto {
  // Target pasture within the same farm. Omit to leave the animal pasture-less (e.g. confinamento).
  @IsOptional()
  @IsString()
  pastureId?: string;

  // Target farm/property, for transfers between properties owned by the same user.
  @IsOptional()
  @IsString()
  targetFarmId?: string;
}
