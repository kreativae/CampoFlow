import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FarmsService } from './farms.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';

// Top-level (not farm-scoped) because the invite token alone identifies which farm
// it's for — the accepting user doesn't know (or need to know) the farmId upfront.
@Controller('convites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly farmsService: FarmsService) {}

  // Throttled to slow down token-guessing attempts (the token itself is the only
  // secret protecting acceptInvite() — see FarmsService.acceptInvite).
  @Post('aceitar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcceptInviteDto) {
    return this.farmsService.acceptInvite(dto.token, user.id, user.email);
  }
}
