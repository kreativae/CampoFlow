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
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

@Controller('farms/:farmId/supplies')
@UseGuards(JwtAuthGuard)
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(@Param('farmId') farmId: string, @Body() dto: CreateSupplyDto) {
    return this.suppliesService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.suppliesService.findAll(farmId);
  }

  @Get('alerts')
  @UseGuards(FarmAccessGuard)
  alerts(@Param('farmId') farmId: string) {
    return this.suppliesService.alerts(farmId);
  }

  @Get(':supplyId')
  @UseGuards(FarmAccessGuard)
  findOne(
    @Param('farmId') farmId: string,
    @Param('supplyId') supplyId: string,
  ) {
    return this.suppliesService.findOne(farmId, supplyId);
  }

  @Patch(':supplyId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  update(
    @Param('farmId') farmId: string,
    @Param('supplyId') supplyId: string,
    @Body() dto: UpdateSupplyDto,
  ) {
    return this.suppliesService.update(farmId, supplyId, dto);
  }

  @Delete(':supplyId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('supplyId') supplyId: string) {
    return this.suppliesService.remove(farmId, supplyId);
  }

  @Post(':supplyId/movements')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  addMovement(
    @Param('farmId') farmId: string,
    @Param('supplyId') supplyId: string,
    @Body() dto: CreateMovementDto,
  ) {
    return this.suppliesService.addMovement(farmId, supplyId, dto);
  }
}
