import { Module } from '@nestjs/common';
import { PasturesService } from './pastures.service';
import { PasturesController } from './pastures.controller';

@Module({
  providers: [PasturesService],
  controllers: [PasturesController],
})
export class PasturesModule {}
