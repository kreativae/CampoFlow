import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WeighingsService } from './weighings.service';
import { CreateWeighingDto } from './dto/create-weighing.dto';

@Controller('fazendas/:farmId/animais/:animalId/pesagens')
@UseGuards(JwtAuthGuard)
export class WeighingsController {
  constructor(private readonly weighingsService: WeighingsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.VETERINARIAN, Role.EMPLOYEE)
  create(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Body() dto: CreateWeighingDto,
  ) {
    return this.weighingsService.create(farmId, animalId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  list(@Param('farmId') farmId: string, @Param('animalId') animalId: string) {
    return this.weighingsService.list(farmId, animalId);
  }

  @Get('resumo-ganho')
  @UseGuards(FarmAccessGuard)
  gainSummary(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
  ) {
    return this.weighingsService.gainSummary(farmId, animalId);
  }
}
