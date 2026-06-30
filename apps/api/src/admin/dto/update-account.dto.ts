import { IsOptional, IsString } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  document?: string;
}
