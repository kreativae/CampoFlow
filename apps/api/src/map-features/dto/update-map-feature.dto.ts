import { PartialType } from '@nestjs/mapped-types';
import { CreateMapFeatureDto } from './create-map-feature.dto';

export class UpdateMapFeatureDto extends PartialType(CreateMapFeatureDto) {}
