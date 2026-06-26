import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationSource,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HealthRecordsService } from '../health-records/health-records.service';
import { AgendaService } from '../agenda/agenda.service';
import { SuppliesService } from '../supplies/supplies.service';
import { WeatherService } from '../weather/weather.service';

interface AlertCandidate {
  source: NotificationSource;
  title: string;
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthRecordsService: HealthRecordsService,
    private readonly agendaService: AgendaService,
    private readonly suppliesService: SuppliesService,
    private readonly weatherService: WeatherService,
  ) {}

  private async collectAlerts(farmId: string): Promise<AlertCandidate[]> {
    const [vaccinations, agendaItems, supplies, weatherAlerts] =
      await Promise.all([
        this.healthRecordsService.pendingAlerts(farmId),
        this.agendaService.alerts(farmId),
        this.suppliesService.alerts(farmId),
        this.weatherService.activeAlerts(farmId),
      ]);

    const candidates: AlertCandidate[] = [];

    for (const v of vaccinations) {
      candidates.push({
        source: NotificationSource.SANIDADE,
        title: 'Vacinação pendente',
        message: `${v.vaccineName} para o animal ${v.animalEarTag} (previsto para ${new Date(v.scheduledDate).toLocaleDateString('pt-BR')})`,
      });
    }

    for (const a of agendaItems) {
      candidates.push({
        source: NotificationSource.AGENDA,
        title: a.overdue ? 'Tarefa atrasada' : 'Tarefa próxima',
        message: `${a.title} (${new Date(a.scheduledDate).toLocaleDateString('pt-BR')})`,
      });
    }

    for (const s of supplies) {
      if (s.lowStock) {
        candidates.push({
          source: NotificationSource.INSUMOS,
          title: 'Estoque baixo',
          message: `${s.name}: ${s.currentQuantity}${s.unit} (mínimo ${s.minimumQuantity}${s.unit})`,
        });
      }
      if (s.expiringSoon || s.expired) {
        candidates.push({
          source: NotificationSource.INSUMOS,
          title: s.expired ? 'Insumo vencido' : 'Insumo próximo do vencimento',
          message: `${s.name}`,
        });
      }
    }

    for (const w of weatherAlerts) {
      candidates.push({
        source: NotificationSource.CLIMA,
        title: 'Alerta climático',
        message: `${w.alertType} registrado em ${new Date(w.recordedAt).toLocaleDateString('pt-BR')}`,
      });
    }

    return candidates;
  }

  // Generates notifications for every member of the farm based on current pending
  // alerts from the other modules. Idempotent: skips a candidate if an unread
  // notification with the same title+message already exists for that user, so
  // calling this repeatedly (e.g. on every dashboard load) does not spam duplicates.
  //
  // Only the IN_APP channel is genuinely delivered here (persisted + shown in the
  // notification center). EMAIL/SMS/PUSH have no real provider configured in this
  // environment (no SendGrid/Twilio/FCM credentials), so a record is still created
  // documenting what would have been sent, with status SIMULATED instead of SENT.
  async generateFromAlerts(farmId: string) {
    const candidates = await this.collectAlerts(farmId);
    if (candidates.length === 0) {
      return { created: 0 };
    }

    const memberships = await this.prisma.membership.findMany({
      where: { farmId },
      select: { userId: true },
    });

    let created = 0;
    for (const { userId } of memberships) {
      const existing = await this.prisma.notification.findMany({
        where: { farmId, userId, read: false },
        select: { title: true, message: true },
      });
      const existingKeys = new Set(
        existing.map((e) => `${e.title}::${e.message}`),
      );

      for (const candidate of candidates) {
        const key = `${candidate.title}::${candidate.message}`;
        if (existingKeys.has(key)) continue;

        await this.dispatch(farmId, userId, candidate);
        existingKeys.add(key);
        created += 1;
      }
    }

    return { created };
  }

  private dispatch(
    farmId: string,
    userId: string,
    candidate: AlertCandidate,
    channel: NotificationChannel = NotificationChannel.IN_APP,
  ) {
    const status =
      channel === NotificationChannel.IN_APP
        ? NotificationStatus.SENT
        : NotificationStatus.SIMULATED;

    return this.prisma.notification.create({
      data: {
        farmId,
        userId,
        title: candidate.title,
        message: candidate.message,
        source: candidate.source,
        channel,
        status,
      },
    });
  }

  findAll(farmId: string, userId: string, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: { farmId, userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  unreadCount(farmId: string, userId: string) {
    return this.prisma.notification.count({
      where: { farmId, userId, read: false },
    });
  }

  async markRead(farmId: string, userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (
      !notification ||
      notification.farmId !== farmId ||
      notification.userId !== userId
    ) {
      throw new NotFoundException('Notificação não encontrada');
    }
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(farmId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { farmId, userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}
