import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

// Gates every /admin/* route. Must run after JwtAuthGuard (which populates
// request.user) — see AdminController's @UseGuards ordering.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Acesso restrito à equipe da plataforma');
    }
    return true;
  }
}
