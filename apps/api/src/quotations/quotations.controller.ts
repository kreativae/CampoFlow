import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { QuotationsService } from './quotations.service';
import { ExternalQuotationsService } from './external-quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@Controller('cotacoes')
@UseGuards(JwtAuthGuard)
export class QuotationsController {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly externalQuotationsService: ExternalQuotationsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.quotationsService.create(user.id, dto);
  }

  // Manual trigger for the same automatic fetch the cron job runs every 3h —
  // lets the web UI offer an "atualizar agora" button instead of waiting.
  @Post('atualizar')
  refresh() {
    return this.externalQuotationsService.refresh();
  }

  @Get('recente')
  latest() {
    return this.quotationsService.latest();
  }

  @Get()
  history(@Query() query: HistoryQueryDto) {
    return this.quotationsService.history(query.commodity, query.limit);
  }
}
