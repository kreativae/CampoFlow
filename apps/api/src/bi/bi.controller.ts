import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BiService } from './bi.service';

// Restricted to OWNER/MANAGER since this surfaces financial KPIs, consistent with
// FinanceController, DashboardController, and ReportsController.
@Controller('farms/:farmId/bi')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class BiController {
  constructor(private readonly biService: BiService) {}

  @Get()
  overview(@Param('farmId') farmId: string) {
    return this.biService.overview(farmId);
  }
}
