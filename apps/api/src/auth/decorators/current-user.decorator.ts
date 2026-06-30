import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Membership } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  accountId: string;
  isAccountAdmin: boolean;
  isPlatformAdmin: boolean;
  memberships: Membership[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUser;
  },
);
