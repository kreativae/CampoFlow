import { PartialType } from '@nestjs/mapped-types';
import { CreateCropApplicationDto } from './create-crop-application.dto';

export class UpdateCropApplicationDto extends PartialType(
  CreateCropApplicationDto,
) {}
