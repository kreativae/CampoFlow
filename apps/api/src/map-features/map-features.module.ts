import { Module } from '@nestjs/common';
import { MapFeaturesService } from './map-features.service';
import { MapFeaturesController } from './map-features.controller';

@Module({
  providers: [MapFeaturesService],
  controllers: [MapFeaturesController],
})
export class MapFeaturesModule {}
