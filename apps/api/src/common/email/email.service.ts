import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

const DEFAULT_FROM = 'CampoFlow <notificacoes@campoflow.app>';

// Thin wrapper around Resend. Without RESEND_API_KEY configured (the default in
// this environment, since no real account exists yet), isConfigured() returns
// false and callers are expected to record the notification as SIMULATED instead
// of calling send() — see NotificationsService.dispatch().
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const result = await this.client.emails.send({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to,
        subject,
        html,
      });
      if (result.error) {
        this.logger.warn(
          `Falha ao enviar e-mail para ${to}: ${result.error.message}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `Erro ao enviar e-mail para ${to}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
