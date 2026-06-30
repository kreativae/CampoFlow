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
import { UpdateMovementDto } from './dto/update-movement.dto';

@Controller('fazendas/:farmId/insumos')
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

  @Get('alertas')
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

  @Post(':supplyId/movimentacoes')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  addMovement(
    @Param('farmId') farmId: string,
    @Param('supplyId') supplyId: string,
    @Body() dto: CreateMovementDto,
  ) {
    return this.suppliesService.addMovement(farmId, supplyId, dto);
  }

  @Patch(':supplyId/movimentacoes/:movementId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  updateMovement(
    @Param('farmId') farmId: string,
    @Param('supplyId') supplyId: string,
    @Param('movementId') movementId: string,
    @Body() dto: UpdateMovementDto,
  ) {
    return this.suppliesService.updateMovement(
      farmId,
      supplyId,
      movementId,
      dto,
    );
  }

  @Delete(':supplyId/movimentacoes/:movementId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  removeMovement(
    @Param('farmId') farmId: string,
    @Param('supplyId') supplyId: string,
    @Param('movementId') movementId: string,
  ) {
    return this.suppliesService.removeMovement(farmId, supplyId, movementId);
  }
}
