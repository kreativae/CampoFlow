import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateDealDto } from './create-deal.dto';

export class UpdateDealDto extends PartialType(CreateDealDto) {
  @IsOptional()
  @IsEnum(['RASCUNHO', 'FINALIZADO', 'CANCELADO'])
  status?: 'RASCUNHO' | 'FINALIZADO' | 'CANCELADO';
}
