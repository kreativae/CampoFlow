import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNotificationConfigDto {
  // Uma das chaves de frequência conhecidas (validada no service contra FREQUENCY_CRON).
  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
