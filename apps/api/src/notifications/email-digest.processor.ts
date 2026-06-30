import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { EMAIL_DIGEST_QUEUE } from '../common/queue/queue.constants';

export interface EmailDigestJobData {
  notificationId: string;
  to: string;
  subject: string;
  html: string;
}

// Consumes jobs enqueued by NotificationsService.dispatchEmailDigest(). Runs out of
// the HTTP request/response cycle, so a slow Resend call never blocks
// generateFromAlerts() (called from the dashboard load) — the Notification row
// starts as PENDING and this processor flips it to SENT/FAILED once the send
// actually completes.
@Processor(EMAIL_DIGEST_QUEUE)
export class EmailDigestProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EmailDigestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  // BullMQ/ioredis treat an unhandled "error" event on the underlying connection as
  // a fatal, process-crashing error. In normal operation Redis connection hiccups
  // are transient and the client retries — we just need a listener so Node doesn't
  // escalate it. Notably matters in the e2e suite, where every spec file boots its
  // own NestJS app (and its own queue connection) and tears it down at the end.
  onModuleInit() {
    this.worker.on('error', (err) => {
      this.logger.warn(
        `Worker de e-mail reportou erro de conexão: ${err.message}`,
      );
    });
  }

  async process(job: Job<EmailDigestJobData>): Promise<void> {
    const { notificationId, to, subject, html } = job.data;
    const sent = await this.emailService.send(to, subject, html);

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: sent ? NotificationStatus.SENT : NotificationStatus.FAILED,
      },
    });

    if (!sent) {
      // Throwing triggers BullMQ's configured retry/backoff before giving up — the
      // FAILED status above already reflects the most recent attempt either way.
      throw new Error(`Falha ao enviar e-mail de resumo para ${to}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailDigestJobData>, err: Error) {
    this.logger.warn(
      `Job de e-mail ${job.id} para ${job.data.to} falhou definitivamente: ${err.message}`,
    );
  }
}
