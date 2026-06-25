import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FarmsService } from './farms.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('farms')
@UseGuards(JwtAuthGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFarmDto) {
    return this.farmsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.farmsService.findAllForUser(user.id);
  }

  @Post(':farmId/members')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  addMember(@Param('farmId') farmId: string, @Body() dto: AddMemberDto) {
    return this.farmsService.addMember(farmId, dto);
  }
}
