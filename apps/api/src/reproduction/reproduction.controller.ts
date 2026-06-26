import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReproductionService } from './reproduction.service';
import { CreateReproductiveEventDto } from './dto/create-reproductive-event.dto';

@Controller('fazendas/:farmId')
@UseGuards(JwtAuthGuard)
export class ReproductionController {
  constructor(private readonly reproductionService: ReproductionService) {}

  @Get('reproducao/estatisticas')
  @UseGuards(FarmAccessGuard)
  stats(@Param('farmId') farmId: string) {
    return this.reproductionService.stats(farmId);
  }

  @Post('animais/:animalId/eventos-reprodutivos')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.VETERINARIAN, Role.EMPLOYEE)
  create(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Body() dto: CreateReproductiveEventDto,
  ) {
    return this.reproductionService.create(farmId, animalId, dto);
  }

  @Get('animais/:animalId/eventos-reprodutivos')
  @UseGuards(FarmAccessGuard)
  listForAnimal(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
  ) {
    return this.reproductionService.listForAnimal(farmId, animalId);
  }
}
