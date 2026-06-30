import { PartialType } from '@nestjs/mapped-types';
import { CreateCropCycleDto } from './create-crop-cycle.dto';

// mapFeatureId accepts null (clears the talhão link) in addition to a UUID, inherited
// as-is from CreateCropCycleDto; undefined still means "leave unchanged" for every field.
export class UpdateCropCycleDto extends PartialType(CreateCropCycleDto) {}
