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
import { PasturesService } from './pastures.service';
import { CreatePastureDto } from './dto/create-pasture.dto';
import { UpdatePastureDto } from './dto/update-pasture.dto';
import { CreateOccupationDto } from './dto/create-occupation.dto';
import { RegisterExitDto } from './dto/register-exit.dto';
import { UpdateOccupationDto } from './dto/update-occupation.dto';

@Controller('fazendas/:farmId/pastagens')
@UseGuards(JwtAuthGuard)
export class PasturesController {
  constructor(private readonly pasturesService: PasturesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Param('farmId') farmId: string, @Body() dto: CreatePastureDto) {
    return this.pasturesService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.pasturesService.findAll(farmId);
  }

  @Get(':pastureId')
  @UseGuards(FarmAccessGuard)
  findOne(
    @Param('farmId') farmId: string,
    @Param('pastureId') pastureId: string,
  ) {
    return this.pasturesService.findOne(farmId, pastureId);
  }

  @Patch(':pastureId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(
    @Param('farmId') farmId: string,
    @Param('pastureId') pastureId: string,
    @Body() dto: UpdatePastureDto,
  ) {
    return this.pasturesService.update(farmId, pastureId, dto);
  }

  @Delete(':pastureId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(
    @Param('farmId') farmId: string,
    @Param('pastureId') pastureId: string,
  ) {
    return this.pasturesService.remove(farmId, pastureId);
  }

  @Post(':pastureId/ocupacoes')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  enterOccupation(
    @Param('farmId') farmId: string,
    @Param('pastureId') pastureId: string,
    @Body() dto: CreateOccupationDto,
  ) {
    return this.pasturesService.enterOccupation(farmId, pastureId, dto);
  }

  @Patch(':pastureId/ocupacoes/:occupationId/saida')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  exitOccupation(
    @Param('farmId') farmId: string,
    @Param('pastureId') pastureId: string,
    @Param('occupationId') occupationId: string,
    @Body() dto: RegisterExitDto,
  ) {
    return this.pasturesService.exitOccupation(
      farmId,
      pastureId,
      occupationId,
      dto,
    );
  }

  @Patch(':pastureId/ocupacoes/:occupationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  updateOccupation(
    @Param('farmId') farmId: string,
    @Param('pastureId') pastureId: string,
    @Param('occupationId') occupationId: string,
    @Body() dto: UpdateOccupationDto,
  ) {
    return this.pasturesService.updateOccupation(
      farmId,
      pastureId,
      occupationId,
      dto,
    );
  }
}
