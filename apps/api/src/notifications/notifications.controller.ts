import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('farms/:farmId/notifications')
@UseGuards(JwtAuthGuard, FarmAccessGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('generate')
  generate(@Param('farmId') farmId: string) {
    return this.notificationsService.generateFromAlerts(farmId);
  }

  @Get()
  findAll(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findAll(
      farmId,
      user.id,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  unreadCount(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.unreadCount(farmId, user.id);
  }

  @Patch(':notificationId/read')
  markRead(
    @Param('farmId') farmId: string,
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markRead(farmId, user.id, notificationId);
  }

  @Patch('read-all')
  markAllRead(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markAllRead(farmId, user.id);
  }
}
