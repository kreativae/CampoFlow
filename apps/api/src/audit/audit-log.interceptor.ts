import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

// Records who changed what for every mutating request, independent of business outcome.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.includes(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(tap(() => this.record(context, request)));
  }

  private record(context: ExecutionContext, request: Request) {
    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user as AuthenticatedUser | undefined;

    this.prisma.auditLog
      .create({
        data: {
          userId: user?.id,
          userEmail: user?.email,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
        },
      })
      .catch(() => undefined);
  }
}
