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
import { MapFeaturesService } from './map-features.service';
import { CreateMapFeatureDto } from './dto/create-map-feature.dto';
import { UpdateMapFeatureDto } from './dto/update-map-feature.dto';

@Controller('farms/:farmId/map-features')
@UseGuards(JwtAuthGuard)
export class MapFeaturesController {
  constructor(private readonly mapFeaturesService: MapFeaturesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Param('farmId') farmId: string, @Body() dto: CreateMapFeatureDto) {
    return this.mapFeaturesService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.mapFeaturesService.findAll(farmId);
  }

  @Get(':featureId')
  @UseGuards(FarmAccessGuard)
  findOne(
    @Param('farmId') farmId: string,
    @Param('featureId') featureId: string,
  ) {
    return this.mapFeaturesService.findOne(farmId, featureId);
  }

  @Patch(':featureId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(
    @Param('farmId') farmId: string,
    @Param('featureId') featureId: string,
    @Body() dto: UpdateMapFeatureDto,
  ) {
    return this.mapFeaturesService.update(farmId, featureId, dto);
  }

  @Delete(':featureId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(
    @Param('farmId') farmId: string,
    @Param('featureId') featureId: string,
  ) {
    return this.mapFeaturesService.remove(farmId, featureId);
  }
}
