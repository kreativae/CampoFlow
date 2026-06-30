import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { AddMessageDto } from './dto/add-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

// Platform-staff view: every ticket across every account.
@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@Query('status') status?: TicketStatus) {
    return this.ticketsService.findAllForAdmin(status);
  }

  @Get(':ticketId')
  findOne(@Param('ticketId') ticketId: string) {
    return this.ticketsService.findOneForAdmin(ticketId);
  }

  @Post(':ticketId/mensagens')
  addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.ticketsService.addMessageAsStaff(ticketId, user.id, dto);
  }

  @Patch(':ticketId/status')
  updateStatus(
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(ticketId, dto.status);
  }
}
