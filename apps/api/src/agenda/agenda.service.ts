import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgendaEventDto } from './dto/create-agenda-event.dto';
import { UpdateAgendaEventDto } from './dto/update-agenda-event.dto';

const UPCOMING_WINDOW_DAYS = 7;

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreateAgendaEventDto) {
    return this.prisma.agendaEvent.create({
      data: {
        farmId,
        title: dto.title,
        type: dto.type,
        scheduledDate: new Date(dto.scheduledDate),
        notes: dto.notes,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.agendaEvent.findMany({
      where: { farmId },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async findOne(farmId: string, eventId: string) {
    const event = await this.prisma.agendaEvent.findUnique({
      where: { id: eventId },
    });
    if (!event || event.farmId !== farmId) {
      throw new NotFoundException('Evento não encontrado');
    }
    return event;
  }

  async update(farmId: string, eventId: string, dto: UpdateAgendaEventDto) {
    await this.findOne(farmId, eventId);
    return this.prisma.agendaEvent.update({
      where: { id: eventId },
      data: {
        ...dto,
        scheduledDate: dto.scheduledDate
          ? new Date(dto.scheduledDate)
          : undefined,
      },
    });
  }

  async markCompleted(farmId: string, eventId: string) {
    await this.findOne(farmId, eventId);
    return this.prisma.agendaEvent.update({
      where: { id: eventId },
      data: { completedAt: new Date() },
    });
  }

  async remove(farmId: string, eventId: string) {
    await this.findOne(farmId, eventId);
    await this.prisma.agendaEvent.delete({ where: { id: eventId } });
    return { success: true };
  }

  // Pending events due within the window or already overdue, for farm-wide alerts.
  async alerts(farmId: string) {
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + UPCOMING_WINDOW_DAYS);

    const pending = await this.prisma.agendaEvent.findMany({
      where: { farmId, completedAt: null, scheduledDate: { lte: windowEnd } },
      orderBy: { scheduledDate: 'asc' },
    });

    const now = new Date();
    return pending.map((e) => ({ ...e, overdue: e.scheduledDate < now }));
  }
}
