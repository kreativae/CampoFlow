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
import { WeatherService } from './weather.service';
import { ExternalWeatherService } from './external-weather.service';
import { CreateWeatherRecordDto } from './dto/create-weather-record.dto';
import { UpdateWeatherRecordDto } from './dto/update-weather-record.dto';

@Controller('fazendas/:farmId/clima')
@UseGuards(JwtAuthGuard)
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly externalWeatherService: ExternalWeatherService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(@Param('farmId') farmId: string, @Body() dto: CreateWeatherRecordDto) {
    return this.weatherService.create(farmId, dto);
  }

  // Manual trigger for the same Open-Meteo fetch the cron job runs every 3h.
  @Post('atualizar')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  refresh(@Param('farmId') farmId: string) {
    return this.externalWeatherService.refreshForFarm(farmId);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  history(@Param('farmId') farmId: string) {
    return this.weatherService.history(farmId);
  }

  @Get('recente')
  @UseGuards(FarmAccessGuard)
  latest(@Param('farmId') farmId: string) {
    return this.weatherService.latest(farmId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  update(
    @Param('farmId') farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWeatherRecordDto,
  ) {
    return this.weatherService.update(farmId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('id') id: string) {
    return this.weatherService.remove(farmId, id);
  }
}
