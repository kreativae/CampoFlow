import { Module } from '@nestjs/common';
import { PasturesService } from './pastures.service';
import { PasturesController } from './pastures.controller';

@Module({
  providers: [PasturesService],
  controllers: [PasturesController],
  exports: [PasturesService],
})
export class PasturesModule {}
