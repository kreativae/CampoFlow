import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FarmsService } from './farms.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('fazendas')
@UseGuards(JwtAuthGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFarmDto) {
    return this.farmsService.create(user.id, user.accountId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.farmsService.findAllForUser(user.id);
  }

  @Get(':farmId')
  @UseGuards(FarmAccessGuard)
  findOne(@Param('farmId') farmId: string) {
    return this.farmsService.findOne(farmId);
  }

  @Patch(':farmId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param('farmId') farmId: string, @Body() dto: UpdateFarmDto) {
    return this.farmsService.update(farmId, dto);
  }

  @Delete(':farmId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  remove(@Param('farmId') farmId: string) {
    return this.farmsService.remove(farmId);
  }

  @Post(':farmId/membros')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  addMember(
    @Param('farmId') farmId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.farmsService.addMember(farmId, dto, user.id);
  }

  @Get(':farmId/membros')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  listMembers(@Param('farmId') farmId: string) {
    return this.farmsService.listMembers(farmId);
  }

  @Delete(':farmId/membros/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  removeMember(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
  ) {
    return this.farmsService.removeMember(farmId, userId);
  }

  @Get(':farmId/convites')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  listInvites(@Param('farmId') farmId: string) {
    return this.farmsService.listInvites(farmId);
  }

  @Delete(':farmId/convites/:inviteId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  revokeInvite(
    @Param('farmId') farmId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.farmsService.revokeInvite(farmId, inviteId);
  }
}
