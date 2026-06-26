import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { WorkLogsService } from './work-logs.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';

@Controller('fazendas/:farmId/registros-trabalho')
@UseGuards(JwtAuthGuard)
export class WorkLogsController {
  constructor(private readonly workLogsService: WorkLogsService) {}

  // Each team member logs their own hours (apontamento).
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE, Role.VETERINARIAN)
  create(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkLogDto,
  ) {
    return this.workLogsService.create(farmId, user.id, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.workLogsService.findAll(farmId);
  }
}
