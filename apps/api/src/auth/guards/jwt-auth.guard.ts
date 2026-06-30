import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_SUBSCRIPTION_STATUSES } from '../../billing/plans';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];
// Billing routes must stay reachable even when the subscription is suspended —
// otherwise a suspended account could never pay to reactivate itself.
const BILLING_PATH_PREFIX = '/conta/assinatura';

// Every protected controller in the app uses this guard, so it's the single
// chokepoint to also enforce subscription status: a SUSPENDED/CANCELED account can
// still log in and read data, but can't create/edit/delete anything outside of
// /conta/assinatura until it pays or cancels for good.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;

    // Platform staff manage the business, not a farm — they have no Account
    // subscription of their own (see AuthService.register) and have no business
    // reading or writing customer data outside of /admin/* and basic /auth/* session
    // routes (login, me, logout, refresh). This applies to every method, not just
    // mutations, so staff can't even browse a customer's farms via the same API.
    if (user.isPlatformAdmin) {
      if (
        !request.path.startsWith('/admin') &&
        !request.path.startsWith('/auth')
      ) {
        throw new ForbiddenException(
          'Contas da equipe da plataforma não têm acesso às áreas do cliente.',
        );
      }
      return true;
    }

    if (!MUTATING_METHODS.includes(request.method)) {
      return true;
    }
    if (request.path.startsWith(BILLING_PATH_PREFIX)) {
      return true;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId: user.accountId },
    });
    if (
      subscription &&
      !ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status as never)
    ) {
      throw new ForbiddenException(
        'Sua assinatura está suspensa ou cancelada. Acesse /conta/assinatura para reativar.',
      );
    }

    return true;
  }
}
