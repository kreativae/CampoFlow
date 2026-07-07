import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { moduleForSegment } from '../modules';

// Guard GLOBAL que aplica o allowlist de módulos por membro (Membership.moduleAccess).
// Ele apenas RESTRINGE: nunca concede acesso que os outros guards negariam. A
// verificação de assinatura do token continua no JwtAuthGuard de cada rota — se o
// token for inválido, a requisição é rejeitada lá com 401 de qualquer forma.
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const path = (req.path || req.url || '').split('?')[0];

    // Só nos importam rotas /fazendas/:farmId/:segment/...
    const match = /^\/fazendas\/([^/]+)\/([^/?]+)/.exec(path);
    if (!match) return true;

    const farmId = match[1];
    const module = moduleForSegment(match[2]);
    if (!module) return true; // segmento não restringível (ex.: painel)

    // Extrai e verifica o token para descobrir o usuário. Sem token válido,
    // deixamos passar — o JwtAuthGuard da rota fará o 401.
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return true;
    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(auth.slice(7), {
        secret: process.env.JWT_ACCESS_SECRET ?? '',
      });
      userId = payload.sub;
    } catch {
      return true;
    }
    if (!userId) return true;

    const membership = await this.prisma.membership.findUnique({
      where: { userId_farmId: { userId, farmId } },
    });
    // Sem vínculo ou proprietário: não restringimos (FarmAccessGuard/RolesGuard
    // tratam quem não é membro; o dono sempre tem acesso total).
    if (!membership || membership.role === Role.OWNER) return true;

    // Allowlist vazio = acesso total (conforme o papel).
    if (membership.moduleAccess.length === 0) return true;

    if (!membership.moduleAccess.includes(module)) {
      throw new ForbiddenException(
        'Seu acesso a este módulo foi restringido pelo gestor da propriedade.',
      );
    }
    return true;
  }
}
