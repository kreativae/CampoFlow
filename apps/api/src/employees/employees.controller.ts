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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

@Controller('fazendas/:farmId/funcionarios')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Param('farmId') farmId: string, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.employeesService.findAll(farmId);
  }

  @Get('resumo')
  @UseGuards(FarmAccessGuard)
  summary(@Param('farmId') farmId: string) {
    return this.employeesService.summary(farmId);
  }

  @Get(':employeeId')
  @UseGuards(FarmAccessGuard)
  findOne(
    @Param('farmId') farmId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.employeesService.findOne(farmId, employeeId);
  }

  @Patch(':employeeId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(
    @Param('farmId') farmId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(farmId, employeeId, dto);
  }

  @Delete(':employeeId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(
    @Param('farmId') farmId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.employeesService.remove(farmId, employeeId);
  }

  @Post(':employeeId/horas')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  addTimeEntry(
    @Param('farmId') farmId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.employeesService.addTimeEntry(farmId, employeeId, dto);
  }

  @Patch(':employeeId/horas/:timeEntryId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  updateTimeEntry(
    @Param('farmId') farmId: string,
    @Param('employeeId') employeeId: string,
    @Param('timeEntryId') timeEntryId: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.employeesService.updateTimeEntry(
      farmId,
      employeeId,
      timeEntryId,
      dto,
    );
  }

  @Delete(':employeeId/horas/:timeEntryId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  removeTimeEntry(
    @Param('farmId') farmId: string,
    @Param('employeeId') employeeId: string,
    @Param('timeEntryId') timeEntryId: string,
  ) {
    return this.employeesService.removeTimeEntry(
      farmId,
      employeeId,
      timeEntryId,
    );
  }
}
