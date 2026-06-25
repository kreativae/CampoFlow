import {
  ForbiddenException,
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

// Allows access to any user who has a membership on the farm, regardless of role.
@Injectable()
export class FarmAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;
    const farmId = request.params.farmId;

    if (!user || !farmId) {
      throw new ForbiddenException('Acesso negado');
    }

    const isMember = user.memberships.some((m) => m.farmId === farmId);
    if (!isMember) {
      throw new ForbiddenException('Você não tem acesso a esta fazenda');
    }

    return true;
  }
}
