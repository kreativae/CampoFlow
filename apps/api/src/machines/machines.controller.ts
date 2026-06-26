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
import { MachinesService } from './machines.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { CreateFuelRecordDto } from './dto/create-fuel-record.dto';

@Controller('farms/:farmId/machines')
@UseGuards(JwtAuthGuard)
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(@Param('farmId') farmId: string, @Body() dto: CreateMachineDto) {
    return this.machinesService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.machinesService.findAll(farmId);
  }

  @Get('costs')
  @UseGuards(FarmAccessGuard)
  costsSummary(@Param('farmId') farmId: string) {
    return this.machinesService.costsSummary(farmId);
  }

  @Get(':machineId')
  @UseGuards(FarmAccessGuard)
  findOne(
    @Param('farmId') farmId: string,
    @Param('machineId') machineId: string,
  ) {
    return this.machinesService.findOne(farmId, machineId);
  }

  @Patch(':machineId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  update(
    @Param('farmId') farmId: string,
    @Param('machineId') machineId: string,
    @Body() dto: UpdateMachineDto,
  ) {
    return this.machinesService.update(farmId, machineId, dto);
  }

  @Delete(':machineId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(
    @Param('farmId') farmId: string,
    @Param('machineId') machineId: string,
  ) {
    return this.machinesService.remove(farmId, machineId);
  }

  @Post(':machineId/maintenances')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  addMaintenance(
    @Param('farmId') farmId: string,
    @Param('machineId') machineId: string,
    @Body() dto: CreateMaintenanceDto,
  ) {
    return this.machinesService.addMaintenance(farmId, machineId, dto);
  }

  @Post(':machineId/fuel-records')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  addFuelRecord(
    @Param('farmId') farmId: string,
    @Param('machineId') machineId: string,
    @Body() dto: CreateFuelRecordDto,
  ) {
    return this.machinesService.addFuelRecord(farmId, machineId, dto);
  }
}
