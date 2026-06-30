import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_DIGEST_QUEUE } from './queue.constants';

// See EmailDigestProcessor for why this exists: an unlistened "error" event on a
// BullMQ connection crashes the process. The Worker side has its own listener; this
// covers the separate Queue connection used by producers (NotificationsService).
@Injectable()
export class QueueErrorListener implements OnModuleInit {
  private readonly logger = new Logger(QueueErrorListener.name);

  constructor(@InjectQueue(EMAIL_DIGEST_QUEUE) private readonly queue: Queue) {}

  onModuleInit() {
    this.queue.on('error', (err) => {
      this.logger.warn(
        `Fila de e-mail reportou erro de conexão: ${err.message}`,
      );
    });
  }
}
