import { PartialType } from '@nestjs/mapped-types';
import { OmitType } from '@nestjs/mapped-types';
import { CreateSupplyDto } from './create-supply.dto';

export class UpdateSupplyDto extends PartialType(
  OmitType(CreateSupplyDto, ['initialQuantity'] as const),
) {}
