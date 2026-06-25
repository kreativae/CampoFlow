import { Module } from '@nestjs/common';
import { AnimalsService } from './animals.service';
import { AnimalsController } from './animals.controller';

@Module({
  providers: [AnimalsService],
  controllers: [AnimalsController],
})
export class AnimalsModule {}
