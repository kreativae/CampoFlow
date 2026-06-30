import { IsOptional, IsString } from 'class-validator';

export class UpdateMercadoPagoConfigDto {
  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  publicKey?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
