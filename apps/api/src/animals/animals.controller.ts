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
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { TransferAnimalDto } from './dto/transfer-animal.dto';

@Controller('fazendas/:farmId/animais')
@UseGuards(JwtAuthGuard)
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(@Param('farmId') farmId: string, @Body() dto: CreateAnimalDto) {
    return this.animalsService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.animalsService.findAll(farmId);
  }

  @Get(':animalId')
  @UseGuards(FarmAccessGuard)
  findOne(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
  ) {
    return this.animalsService.findOne(farmId, animalId);
  }

  @Patch(':animalId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  update(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Body() dto: UpdateAnimalDto,
  ) {
    return this.animalsService.update(farmId, animalId, dto);
  }

  @Delete(':animalId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('animalId') animalId: string) {
    return this.animalsService.remove(farmId, animalId);
  }

  @Post(':animalId/transferir')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  transfer(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
    @Body() dto: TransferAnimalDto,
  ) {
    return this.animalsService.transfer(farmId, animalId, dto);
  }

  @Get(':animalId/historico')
  @UseGuards(FarmAccessGuard)
  history(
    @Param('farmId') farmId: string,
    @Param('animalId') animalId: string,
  ) {
    return this.animalsService.history(farmId, animalId);
  }
}
