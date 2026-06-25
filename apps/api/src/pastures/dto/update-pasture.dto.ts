import { PartialType } from '@nestjs/mapped-types';
import { CreatePastureDto } from './create-pasture.dto';

export class UpdatePastureDto extends PartialType(CreatePastureDto) {}
