import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FinanceService } from './finance.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CashFlowQueryDto } from './dto/cash-flow-query.dto';

@Controller('farms/:farmId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  create(@Param('farmId') farmId: string, @Body() dto: CreateTransactionDto) {
    return this.financeService.create(farmId, dto);
  }

  @Get('transactions')
  findAll(@Param('farmId') farmId: string) {
    return this.financeService.findAll(farmId);
  }

  @Get('transactions/:transactionId')
  findOne(
    @Param('farmId') farmId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.financeService.findOne(farmId, transactionId);
  }

  @Patch('transactions/:transactionId')
  update(
    @Param('farmId') farmId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.financeService.update(farmId, transactionId, dto);
  }

  @Patch('transactions/:transactionId/pay')
  markPaid(
    @Param('farmId') farmId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.financeService.markPaid(farmId, transactionId);
  }

  @Delete('transactions/:transactionId')
  remove(
    @Param('farmId') farmId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.financeService.remove(farmId, transactionId);
  }

  @Get('finance/cash-flow')
  cashFlow(@Param('farmId') farmId: string, @Query() query: CashFlowQueryDto) {
    return this.financeService.cashFlow(farmId, query.granularity);
  }
}
