import { PartialType } from '@nestjs/mapped-types';
import { CreateFuelRecordDto } from './create-fuel-record.dto';

export class UpdateFuelRecordDto extends PartialType(CreateFuelRecordDto) {}
