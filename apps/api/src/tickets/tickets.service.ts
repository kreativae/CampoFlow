import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';

const TICKET_INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true } },
  account: { select: { id: true, name: true, billingEmail: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true, email: true } } },
  },
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(accountId: string, userId: string, dto: CreateTicketDto) {
    return this.prisma.ticket.create({
      data: {
        accountId,
        createdById: userId,
        subject: dto.subject,
        priority: dto.priority,
        messages: {
          create: { authorId: userId, message: dto.message, fromStaff: false },
        },
      },
      include: TICKET_INCLUDE,
    });
  }

  findAllForAccount(accountId: string) {
    return this.prisma.ticket.findMany({
      where: { accountId },
      include: TICKET_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOneForAccount(accountId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: TICKET_INCLUDE,
    });
    if (!ticket || ticket.accountId !== accountId) {
      throw new NotFoundException('Ticket não encontrado');
    }
    return ticket;
  }

  async addMessageAsCustomer(
    accountId: string,
    ticketId: string,
    userId: string,
    dto: AddMessageDto,
  ) {
    await this.findOneForAccount(accountId, ticketId);
    await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        authorId: userId,
        message: dto.message,
        fromStaff: false,
      },
    });
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });
    return this.findOneForAccount(accountId, ticketId);
  }

  findAllForAdmin(status?: TicketStatus) {
    return this.prisma.ticket.findMany({
      where: status ? { status } : undefined,
      include: TICKET_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOneForAdmin(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: TICKET_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado');
    }
    return ticket;
  }

  async addMessageAsStaff(
    ticketId: string,
    staffUserId: string,
    dto: AddMessageDto,
  ) {
    await this.findOneForAdmin(ticketId);
    await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        authorId: staffUserId,
        message: dto.message,
        fromStaff: true,
      },
    });
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date(), status: TicketStatus.EM_ANDAMENTO },
    });
    return this.findOneForAdmin(ticketId);
  }

  async updateStatus(ticketId: string, status: TicketStatus) {
    await this.findOneForAdmin(ticketId);
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
      include: TICKET_INCLUDE,
    });
  }
}
