import { PartialType } from '@nestjs/mapped-types';
import { CreateWeighingDto } from './create-weighing.dto';

export class UpdateWeighingDto extends PartialType(CreateWeighingDto) {}
