import { PartialType } from '@nestjs/mapped-types';
import { CreateWeatherRecordDto } from './create-weather-record.dto';

export class UpdateWeatherRecordDto extends PartialType(
  CreateWeatherRecordDto,
) {}
