import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GeometryType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMapFeatureDto } from './dto/create-map-feature.dto';
import { UpdateMapFeatureDto } from './dto/update-map-feature.dto';

const MIN_POLYGON_POINTS = 3;

@Injectable()
export class MapFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertValidGeometry(
    geometryType: GeometryType,
    coordinates: [number, number][],
  ) {
    if (geometryType === GeometryType.PONTO && coordinates.length !== 1) {
      throw new BadRequestException(
        'Um ponto deve ter exatamente uma coordenada [lat, lng]',
      );
    }
    if (
      geometryType === GeometryType.POLIGONO &&
      coordinates.length < MIN_POLYGON_POINTS
    ) {
      throw new BadRequestException(
        `Um polígono deve ter ao menos ${MIN_POLYGON_POINTS} coordenadas`,
      );
    }
  }

  create(farmId: string, dto: CreateMapFeatureDto) {
    this.assertValidGeometry(dto.geometryType, dto.coordinates);

    return this.prisma.mapFeature.create({
      data: {
        farmId,
        name: dto.name,
        type: dto.type,
        geometryType: dto.geometryType,
        coordinates: dto.coordinates,
        notes: dto.notes,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.mapFeature.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(farmId: string, featureId: string) {
    const feature = await this.prisma.mapFeature.findUnique({
      where: { id: featureId },
    });
    if (!feature || feature.farmId !== farmId) {
      throw new NotFoundException('Elemento do mapa não encontrado');
    }
    return feature;
  }

  async update(farmId: string, featureId: string, dto: UpdateMapFeatureDto) {
    const existing = await this.findOne(farmId, featureId);
    if (dto.coordinates) {
      this.assertValidGeometry(
        dto.geometryType ?? existing.geometryType,
        dto.coordinates,
      );
    }

    return this.prisma.mapFeature.update({
      where: { id: featureId },
      data: {
        ...dto,
        coordinates: dto.coordinates
          ? (dto.coordinates as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async remove(farmId: string, featureId: string) {
    await this.findOne(farmId, featureId);
    await this.prisma.mapFeature.delete({ where: { id: featureId } });
    return { success: true };
  }
}
