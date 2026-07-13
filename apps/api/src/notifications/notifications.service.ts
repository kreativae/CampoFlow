import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotificationChannel,
  NotificationSource,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { EMAIL_DIGEST_QUEUE } from '../common/queue/queue.constants';
import type { EmailDigestJobData } from './email-digest.processor';
import { HealthRecordsService } from '../health-records/health-records.service';
import { AgendaService } from '../agenda/agenda.service';
import { SuppliesService } from '../supplies/supplies.service';

interface AlertCandidate {
  source: NotificationSource;
  title: string;
  message: string;
}

// Frequências que o admin pode escolher para a geração automática, cada uma
// mapeada para a expressão cron correspondente. A UI mostra os rótulos amigáveis.
const FREQUENCY_CRON: Record<string, string> = {
  EVERY_15MIN: '*/15 * * * *',
  EVERY_30MIN: '*/30 * * * *',
  HOURLY: '0 * * * *',
  EVERY_6H: '0 */6 * * *',
  EVERY_12H: '0 */12 * * *',
  DAILY_8H: '0 8 * * *',
};
const FREQUENCY_LABEL: Record<string, string> = {
  EVERY_15MIN: 'A cada 15 minutos',
  EVERY_30MIN: 'A cada 30 minutos',
  HOURLY: 'A cada hora',
  EVERY_6H: 'A cada 6 horas',
  EVERY_12H: 'A cada 12 horas',
  DAILY_8H: 'Uma vez ao dia (08:00)',
};
const DEFAULT_FREQUENCY = 'HOURLY';
const CRON_JOB_NAME = 'notifications:auto-generate';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectQueue(EMAIL_DIGEST_QUEUE)
    private readonly emailDigestQueue: Queue<EmailDigestJobData>,
    private readonly healthRecordsService: HealthRecordsService,
    private readonly agendaService: AgendaService,
    private readonly suppliesService: SuppliesService,
  ) {}

  // Carrega a config salva e agenda o cron dinâmico no boot. Pulado sob teste para
  // não disparar geração durante os e2e.
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const setting = await this.getOrCreateSetting();
    this.applySchedule(setting.frequency, setting.enabled);
  }

  private async getOrCreateSetting() {
    return this.prisma.notificationSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default', frequency: DEFAULT_FREQUENCY, enabled: true },
    });
  }

  // (Re)programa o cron dinâmico: remove o job existente e cria um novo com a
  // expressão da frequência escolhida, se estiver habilitado.
  private applySchedule(frequency: string, enabled: boolean) {
    try {
      this.schedulerRegistry.deleteCronJob(CRON_JOB_NAME);
    } catch {
      // Nenhum job registrado ainda — tudo bem.
    }
    if (!enabled) return;

    const cronTime =
      FREQUENCY_CRON[frequency] ?? FREQUENCY_CRON[DEFAULT_FREQUENCY];
    const job = CronJob.from({
      cronTime,
      onTick: () => {
        void this.scheduledGenerateForAllFarms();
      },
      start: true,
    });
    this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
  }

  // Config atual + opções disponíveis, para o painel admin.
  async getSchedule() {
    const setting = await this.getOrCreateSetting();
    return {
      frequency: setting.frequency,
      enabled: setting.enabled,
      updatedAt: setting.updatedAt,
      options: Object.keys(FREQUENCY_CRON).map((key) => ({
        key,
        label: FREQUENCY_LABEL[key],
        cron: FREQUENCY_CRON[key],
      })),
    };
  }

  // Atualiza a config (admin) e reprograma o cron na hora.
  async updateSchedule(input: { frequency?: string; enabled?: boolean }) {
    if (input.frequency && !(input.frequency in FREQUENCY_CRON)) {
      throw new NotFoundException('Frequência inválida');
    }
    const setting = await this.prisma.notificationSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(input.frequency ? { frequency: input.frequency } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
      create: {
        id: 'default',
        frequency: input.frequency ?? DEFAULT_FREQUENCY,
        enabled: input.enabled ?? true,
      },
    });
    if (process.env.NODE_ENV !== 'test') {
      this.applySchedule(setting.frequency, setting.enabled);
    }
    return this.getSchedule();
  }

  private async collectAlerts(farmId: string): Promise<AlertCandidate[]> {
    const [vaccinations, agendaItems, supplies] = await Promise.all([
      this.healthRecordsService.pendingAlerts(farmId),
      this.agendaService.alerts(farmId),
      this.suppliesService.alerts(farmId),
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

    return candidates;
  }

  // Varre todas as fazendas e gera as notificações pendentes de cada uma, para que o
  // produtor seja avisado sem precisar abrir a tela e clicar em "gerar". A cadência é
  // configurável pelo admin (applySchedule/updateSchedule). generateFromAlerts é
  // idempotente (deduplica por título+mensagem não lida), então repetir não gera spam.
  // Cada fazenda é isolada num try/catch para que uma falha não interrompa as demais.
  async scheduledGenerateForAllFarms() {
    const farms = await this.prisma.farm.findMany({ select: { id: true } });
    let total = 0;
    for (const farm of farms) {
      try {
        const { created } = await this.generateFromAlerts(farm.id);
        total += created;
      } catch (err) {
        this.logger.warn(
          `Falha ao gerar notificações da fazenda ${farm.id}: ${(err as Error).message}`,
        );
      }
    }
    if (total > 0) {
      this.logger.log(`Notificações automáticas geradas: ${total}`);
    }
  }

  // Generates notifications for every member of the farm based on current pending
  // alerts from the other modules. Idempotent: skips a candidate if an unread
  // notification with the same title+message already exists for that user, so
  // calling this repeatedly (e.g. on every dashboard load) does not spam duplicates.
  //
  // The IN_APP channel is always genuinely delivered (persisted + shown in the
  // notification center). When RESEND_API_KEY is configured, each user with at
  // least one new alert also gets a real digest e-mail (one e-mail per call, not
  // one per alert) via EmailService; that send is recorded as its own EMAIL-channel
  // Notification row, with status SENT/FAILED reflecting whether Resend actually
  // accepted it. Without RESEND_API_KEY (this environment's default, no real
  // provider account exists), the row is still created so it's clear what would
  // have been sent, with status SIMULATED instead of claiming a delivery that
  // didn't happen.
  async generateFromAlerts(farmId: string) {
    const candidates = await this.collectAlerts(farmId);
    if (candidates.length === 0) {
      return { created: 0 };
    }

    const memberships = await this.prisma.membership.findMany({
      where: { farmId },
      select: { userId: true, user: { select: { email: true, name: true } } },
    });

    let created = 0;
    for (const { userId, user } of memberships) {
      const existing = await this.prisma.notification.findMany({
        where: { farmId, userId, read: false },
        select: { title: true, message: true },
      });
      const existingKeys = new Set(
        existing.map((e) => `${e.title}::${e.message}`),
      );

      const newCandidates: AlertCandidate[] = [];
      for (const candidate of candidates) {
        const key = `${candidate.title}::${candidate.message}`;
        if (existingKeys.has(key)) continue;

        await this.dispatchInApp(farmId, userId, candidate);
        existingKeys.add(key);
        newCandidates.push(candidate);
        created += 1;
      }

      if (newCandidates.length > 0) {
        await this.dispatchEmailDigest(farmId, userId, user, newCandidates);
      }
    }

    return { created };
  }

  private dispatchInApp(
    farmId: string,
    userId: string,
    candidate: AlertCandidate,
  ) {
    return this.prisma.notification.create({
      data: {
        farmId,
        userId,
        title: candidate.title,
        message: candidate.message,
        source: candidate.source,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
      },
    });
  }

  // Without RESEND_API_KEY there's no network call to make, so the SIMULATED row is
  // created synchronously. With it configured, the actual send is enqueued
  // (EmailDigestProcessor) instead of awaited here — a slow/down Resend would
  // otherwise block whatever request triggered generateFromAlerts() (e.g. a
  // dashboard load). The row starts PENDING and the processor flips it to
  // SENT/FAILED once the job actually runs.
  private async dispatchEmailDigest(
    farmId: string,
    userId: string,
    user: { email: string; name: string },
    candidates: AlertCandidate[],
  ) {
    const subject = `CampoFlow: ${candidates.length} novo(s) alerta(s)`;
    const itemsHtml = candidates
      .map((c) => `<li><strong>${c.title}</strong>: ${c.message}</li>`)
      .join('');
    const html = `<p>Olá, ${user.name}.</p><p>Você tem ${candidates.length} novo(s) alerta(s) no CampoFlow:</p><ul>${itemsHtml}</ul>`;
    const configured = this.emailService.isConfigured();

    const notification = await this.prisma.notification.create({
      data: {
        farmId,
        userId,
        title: 'Resumo de alertas enviado por e-mail',
        message: `${candidates.length} alerta(s) resumidos em e-mail para ${user.email}`,
        source: NotificationSource.OUTRO,
        channel: NotificationChannel.EMAIL,
        status: configured
          ? NotificationStatus.PENDING
          : NotificationStatus.SIMULATED,
      },
    });

    if (configured) {
      await this.emailDigestQueue.add('send', {
        notificationId: notification.id,
        to: user.email,
        subject,
        html,
      });
    }
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

  async deleteMany(farmId: string, userId: string, ids: string[]) {
    const result = await this.prisma.notification.deleteMany({
      where: { farmId, userId, id: { in: ids } },
    });
    return { deleted: result.count };
  }
}
