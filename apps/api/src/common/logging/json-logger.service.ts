import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

// Structured (JSON-line) logger so production log output is grep/parseable by any
// log aggregator (Railway, Datadog, CloudWatch, etc.) without needing a separate
// agent like pino — one JSON object per line, stdout only. Falls back to Nest's
// default colored console output in development (LOG_FORMAT unset), since JSON
// lines are hard to read by eye while iterating locally.
@Injectable()
export class JsonLogger extends ConsoleLogger {
  private readonly structured = process.env.LOG_FORMAT === 'json';

  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    if (!this.structured) {
      return super.formatMessage(
        logLevel,
        message,
        pidMessage,
        formattedLogLevel,
        contextMessage,
        timestampDiff,
      );
    }

    const context = contextMessage.replace(/[[\]]/g, '').trim() || undefined;
    const line = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };
    return JSON.stringify(line) + '\n';
  }
}
