import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueErrorListener } from './queue-error-listener.service';
import { EMAIL_DIGEST_QUEUE } from './queue.constants';

export { EMAIL_DIGEST_QUEUE };

// Backed by the same Redis instance already used for caching/sessions (REDIS_URL).
// Jobs are processed by EmailDigestProcessor (registered alongside the queue in
// NotificationsModule, since that's the only producer today). Moving a send off the
// request/response cycle means a slow or down Resend never makes
// generateFromAlerts() (called from the dashboard load) hang or time out.
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    BullModule.registerQueue({ name: EMAIL_DIGEST_QUEUE }),
  ],
  providers: [QueueErrorListener],
  exports: [BullModule],
})
export class QueueModule {}
