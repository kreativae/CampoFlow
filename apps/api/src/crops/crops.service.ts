import { Injectable, NotFoundException } from '@nestjs/common';
import { CropCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCropCycleDto } from './dto/create-crop-cycle.dto';
import { UpdateCropCycleDto } from './dto/update-crop-cycle.dto';

export type CropCycleStatus = 'PLANEJADA' | 'PLANTADA' | 'COLHIDA';

@Injectable()
export class CropsService {
  constructor(private readonly prisma: PrismaService) {}

  // Status is derived, not stored: COLHIDA once harvestedAt is set, PLANTADA once
  // plantedAt has passed, PLANEJADA otherwise (planting date still in the future).
  private withStatus(
    cycle: CropCycle,
  ): CropCycle & { status: CropCycleStatus } {
    let status: CropCycleStatus = 'PLANEJADA';
    if (cycle.harvestedAt) {
      status = 'COLHIDA';
    } else if (cycle.plantedAt <= new Date()) {
      status = 'PLANTADA';
    }
    return { ...cycle, status };
  }

  async create(farmId: string, createdById: string, dto: CreateCropCycleDto) {
    if (dto.mapFeatureId) {
      const feature = await this.prisma.mapFeature.findUnique({
        where: { id: dto.mapFeatureId },
      });
      if (!feature || feature.farmId !== farmId) {
        throw new NotFoundException('Elemento do mapa não encontrado');
      }
    }

    const cycle = await this.prisma.cropCycle.create({
      data: {
        farmId,
        mapFeatureId: dto.mapFeatureId,
        cropName: dto.cropName,
        variety: dto.variety,
        areaHectares: dto.areaHectares,
        plantedAt: new Date(dto.plantedAt),
        expectedHarvestAt: dto.expectedHarvestAt
          ? new Date(dto.expectedHarvestAt)
          : undefined,
        harvestedAt: dto.harvestedAt ? new Date(dto.harvestedAt) : undefined,
        yieldKg: dto.yieldKg,
        notes: dto.notes,
        createdById,
      },
    });
    return this.withStatus(cycle);
  }

  async findAll(farmId: string) {
    const cycles = await this.prisma.cropCycle.findMany({
      where: { farmId },
      orderBy: { plantedAt: 'desc' },
    });
    return cycles.map((c) => this.withStatus(c));
  }

  async findOne(farmId: string, id: string) {
    const cycle = await this.prisma.cropCycle.findUnique({ where: { id } });
    if (!cycle || cycle.farmId !== farmId) {
      throw new NotFoundException('Safra não encontrada');
    }
    return this.withStatus(cycle);
  }

  async update(farmId: string, id: string, dto: UpdateCropCycleDto) {
    const existing = await this.prisma.cropCycle.findUnique({ where: { id } });
    if (!existing || existing.farmId !== farmId) {
      throw new NotFoundException('Safra não encontrada');
    }

    if (dto.mapFeatureId) {
      const feature = await this.prisma.mapFeature.findUnique({
        where: { id: dto.mapFeatureId },
      });
      if (!feature || feature.farmId !== farmId) {
        throw new NotFoundException('Elemento do mapa não encontrado');
      }
    }

    const cycle = await this.prisma.cropCycle.update({
      where: { id },
      data: {
        ...(dto.mapFeatureId !== undefined
          ? { mapFeatureId: dto.mapFeatureId }
          : {}),
        ...(dto.cropName !== undefined ? { cropName: dto.cropName } : {}),
        ...(dto.variety !== undefined ? { variety: dto.variety } : {}),
        ...(dto.areaHectares !== undefined
          ? { areaHectares: dto.areaHectares }
          : {}),
        ...(dto.plantedAt !== undefined
          ? { plantedAt: new Date(dto.plantedAt) }
          : {}),
        ...(dto.expectedHarvestAt !== undefined
          ? { expectedHarvestAt: new Date(dto.expectedHarvestAt) }
          : {}),
        ...(dto.harvestedAt !== undefined
          ? { harvestedAt: new Date(dto.harvestedAt) }
          : {}),
        ...(dto.yieldKg !== undefined ? { yieldKg: dto.yieldKg } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    return this.withStatus(cycle);
  }

  async remove(farmId: string, id: string) {
    const existing = await this.prisma.cropCycle.findUnique({ where: { id } });
    if (!existing || existing.farmId !== farmId) {
      throw new NotFoundException('Safra não encontrada');
    }
    await this.prisma.cropCycle.delete({ where: { id } });
    return { success: true };
  }
}
