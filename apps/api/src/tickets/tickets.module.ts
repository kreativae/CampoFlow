import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { AdminTicketsController } from './admin-tickets.controller';

@Module({
  providers: [TicketsService],
  controllers: [TicketsController, AdminTicketsController],
})
export class TicketsModule {}
