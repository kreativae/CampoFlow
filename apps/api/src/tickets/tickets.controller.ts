import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';

// Customer-facing support tickets, scoped to the caller's own billing Account.
@Controller('suporte')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.accountId, user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.findAllForAccount(user.accountId);
  }

  @Get(':ticketId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.findOneForAccount(user.accountId, ticketId);
  }

  @Post(':ticketId/mensagens')
  addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.ticketsService.addMessageAsCustomer(
      user.accountId,
      ticketId,
      user.id,
      dto,
    );
  }
}
