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
import { CropsService } from './crops.service';
import { CreateCropCycleDto } from './dto/create-crop-cycle.dto';
import { UpdateCropCycleDto } from './dto/update-crop-cycle.dto';

@Controller('fazendas/:farmId/safras')
@UseGuards(JwtAuthGuard)
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(
    @Param('farmId') farmId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCropCycleDto,
  ) {
    return this.cropsService.create(farmId, user.id, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.cropsService.findAll(farmId);
  }

  @Get(':id')
  @UseGuards(FarmAccessGuard)
  findOne(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.cropsService.findOne(farmId, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  update(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCropCycleDto,
  ) {
    return this.cropsService.update(farmId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.cropsService.remove(farmId, id);
  }
}
