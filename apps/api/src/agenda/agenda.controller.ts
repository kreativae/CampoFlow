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
import { AgendaService } from './agenda.service';
import { CreateAgendaEventDto } from './dto/create-agenda-event.dto';
import { UpdateAgendaEventDto } from './dto/update-agenda-event.dto';

@Controller('farms/:farmId/agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(@Param('farmId') farmId: string, @Body() dto: CreateAgendaEventDto) {
    return this.agendaService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.agendaService.findAll(farmId);
  }

  @Get('alerts')
  @UseGuards(FarmAccessGuard)
  alerts(@Param('farmId') farmId: string) {
    return this.agendaService.alerts(farmId);
  }

  @Get(':eventId')
  @UseGuards(FarmAccessGuard)
  findOne(@Param('farmId') farmId: string, @Param('eventId') eventId: string) {
    return this.agendaService.findOne(farmId, eventId);
  }

  @Patch(':eventId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  update(
    @Param('farmId') farmId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateAgendaEventDto,
  ) {
    return this.agendaService.update(farmId, eventId, dto);
  }

  @Patch(':eventId/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  markCompleted(
    @Param('farmId') farmId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.agendaService.markCompleted(farmId, eventId);
  }

  @Delete(':eventId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('eventId') eventId: string) {
    return this.agendaService.remove(farmId, eventId);
  }
}
