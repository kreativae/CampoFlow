import { Module } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { QuotationsController } from './quotations.controller';

@Module({
  providers: [QuotationsService],
  controllers: [QuotationsController],
})
export class QuotationsModule {}
