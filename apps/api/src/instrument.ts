// Must be the very first import in main.ts so Sentry can auto-instrument every
// other module (DB calls, HTTP, etc.) before they're loaded. Without SENTRY_DSN
// configured (the default in dev), Sentry.init() is skipped entirely — same
// optional-by-default pattern as EmailService/MercadoPagoService.
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    // Low default sample rate — production traffic volume should tune this via env
    // rather than code changes.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}
