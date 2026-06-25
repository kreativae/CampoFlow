import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WeatherService } from './weather.service';
import { CreateWeatherRecordDto } from './dto/create-weather-record.dto';

@Controller('farms/:farmId/weather')
@UseGuards(JwtAuthGuard)
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(@Param('farmId') farmId: string, @Body() dto: CreateWeatherRecordDto) {
    return this.weatherService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  history(@Param('farmId') farmId: string) {
    return this.weatherService.history(farmId);
  }

  @Get('latest')
  @UseGuards(FarmAccessGuard)
  latest(@Param('farmId') farmId: string) {
    return this.weatherService.latest(farmId);
  }

  @Get('alerts')
  @UseGuards(FarmAccessGuard)
  activeAlerts(@Param('farmId') farmId: string) {
    return this.weatherService.activeAlerts(farmId);
  }
}
