import { Module } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { ExternalWeatherService } from './external-weather.service';
import { WeatherController } from './weather.controller';

@Module({
  providers: [WeatherService, ExternalWeatherService],
  controllers: [WeatherController],
  exports: [WeatherService],
})
export class WeatherModule {}
