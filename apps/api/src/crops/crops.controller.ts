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
import { CreateCropApplicationDto } from './dto/create-crop-application.dto';
import { UpdateCropApplicationDto } from './dto/update-crop-application.dto';
import { PlantingCalculatorDto } from './dto/planting-calculator.dto';
import { CreateCropCostEntryDto } from './dto/create-crop-cost-entry.dto';
import { UpdateCropCostEntryDto } from './dto/update-crop-cost-entry.dto';

@Controller('fazendas/:farmId/safras')
@UseGuards(JwtAuthGuard)
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  // ---- Rotas estáticas (antes das rotas :id) ---------------------------
  @Get('referencias/culturas')
  @UseGuards(FarmAccessGuard)
  cropReferences() {
    return this.cropsService.listCropReferences();
  }

  @Post('calculadora-plantio')
  @UseGuards(FarmAccessGuard)
  plantingCalculator(@Body() dto: PlantingCalculatorDto) {
    return this.cropsService.plantingCalculator(dto);
  }

  @Get('rotacao')
  @UseGuards(FarmAccessGuard)
  rotation(@Param('farmId') farmId: string) {
    return this.cropsService.rotation(farmId);
  }

  @Get('historico')
  @UseGuards(FarmAccessGuard)
  history(@Param('farmId') farmId: string) {
    return this.cropsService.history(farmId);
  }

  // ---- CRUD de safras ---------------------------------------------------
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

  // ---- Planejamento de plantio por safra --------------------------------
  @Get(':id/janela-plantio')
  @UseGuards(FarmAccessGuard)
  plantingWindow(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.cropsService.plantingWindow(farmId, id);
  }

  @Get(':id/recomendacao')
  @UseGuards(FarmAccessGuard)
  fertilizerRecommendation(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
  ) {
    return this.cropsService.fertilizerRecommendation(farmId, id);
  }

  @Get(':id/fechamento')
  @UseGuards(FarmAccessGuard)
  closing(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.cropsService.closing(farmId, id);
  }

  // ---- Custos manuais da safra ------------------------------------------
  @Get(':id/custos')
  @UseGuards(FarmAccessGuard)
  listCostEntries(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.cropsService.listCostEntries(farmId, id);
  }

  @Post(':id/custos')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  addCostEntry(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Body() dto: CreateCropCostEntryDto,
  ) {
    return this.cropsService.addCostEntry(farmId, id, dto);
  }

  @Patch(':id/custos/:entryId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  updateCostEntry(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateCropCostEntryDto,
  ) {
    return this.cropsService.updateCostEntry(farmId, id, entryId, dto);
  }

  @Delete(':id/custos/:entryId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  removeCostEntry(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    return this.cropsService.removeCostEntry(farmId, id, entryId);
  }

  // ---- Caderno de campo (aplicações) ------------------------------------
  @Get(':id/aplicacoes')
  @UseGuards(FarmAccessGuard)
  listApplications(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.cropsService.listApplications(farmId, id);
  }

  @Post(':id/aplicacoes')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  addApplication(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Body() dto: CreateCropApplicationDto,
  ) {
    return this.cropsService.addApplication(farmId, id, dto);
  }

  @Patch(':id/aplicacoes/:applicationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  updateApplication(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateCropApplicationDto,
  ) {
    return this.cropsService.updateApplication(farmId, id, applicationId, dto);
  }

  @Delete(':id/aplicacoes/:applicationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  removeApplication(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.cropsService.removeApplication(farmId, id, applicationId);
  }
}
