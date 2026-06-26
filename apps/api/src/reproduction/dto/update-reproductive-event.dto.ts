import { PartialType } from '@nestjs/mapped-types';
import { CreateReproductiveEventDto } from './create-reproductive-event.dto';

export class UpdateReproductiveEventDto extends PartialType(
  CreateReproductiveEventDto,
) {}
