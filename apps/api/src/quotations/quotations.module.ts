import { Module } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { ExternalQuotationsService } from './external-quotations.service';
import { QuotationsController } from './quotations.controller';

@Module({
  providers: [QuotationsService, ExternalQuotationsService],
  controllers: [QuotationsController],
})
export class QuotationsModule {}
