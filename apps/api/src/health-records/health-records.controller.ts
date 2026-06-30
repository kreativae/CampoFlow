import {
  Body,
  Controller,
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
import { HealthRecordsService } from './health-records.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { ApplyVaccinationDto } from './dto/apply-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { CreateTreatmentDto } from './dto/create-treatment.dto';

@Controller('fazendas/:farmId')
@UseGuards(JwtAuthGuard)
export class HealthRecordsController {
  constructor(private readonly healthRecordsService: HealthRecordsService) {}

  @Get('sanidade/alertas')
  @UseGuards(FarmAccessGuard)
  pendingAlerts(@Param('farmId') farmId: string) {
    return this.healthRecordsService.pendingAlerts(farmId);
  }

  @Get('sanidade/vacinacoes')
  @UseGuards(FarmAccessGuard)
  listAllVaccinations(@Param('farmId') farmId: string) {
    return this.healthRecordsService.listAllForFarm(farmId);
  }

  @Post('animais/:animalId/vacinacoes')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.VETERINARIAN, Role.EMPLOYEE)
  scheduleVaccination(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Body() dto: CreateVaccinationDto,
  ) {
    return this.healthRecordsService.scheduleVaccination(farmId, animalId, dto);
  }

  @Get('animais/:animalId/vacinacoes')
  @UseGuards(FarmAccessGuard)
  listVaccinations(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
  ) {
    return this.healthRecordsService.listVaccinations(farmId, animalId);
  }

  @Patch('animais/:animalId/vacinacoes/:vaccinationId/aplicar')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.VETERINARIAN, Role.EMPLOYEE)
  applyVaccination(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Param('vaccinationId') vaccinationId: string,
    @Body() dto: ApplyVaccinationDto,
  ) {
    return this.healthRecordsService.applyVaccination(
      farmId,
      animalId,
      vaccinationId,
      dto,
    );
  }

  @Patch('animais/:animalId/vacinacoes/:vaccinationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.VETERINARIAN, Role.EMPLOYEE)
  updateVaccination(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Param('vaccinationId') vaccinationId: string,
    @Body() dto: UpdateVaccinationDto,
  ) {
    return this.healthRecordsService.updateVaccination(
      farmId,
      animalId,
      vaccinationId,
      dto,
    );
  }

  @Post('animais/:animalId/tratamentos')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.VETERINARIAN)
  createTreatment(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Body() dto: CreateTreatmentDto,
  ) {
    return this.healthRecordsService.createTreatment(farmId, animalId, dto);
  }

  @Get('animais/:animalId/tratamentos')
  @UseGuards(FarmAccessGuard)
  listTreatments(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
  ) {
    return this.healthRecordsService.listTreatments(farmId, animalId);
  }
}
