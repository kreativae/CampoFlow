import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePastureDto } from './dto/create-pasture.dto';
import { UpdatePastureDto } from './dto/update-pasture.dto';
import { CreateOccupationDto } from './dto/create-occupation.dto';

@Injectable()
export class PasturesService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreatePastureDto) {
    return this.prisma.pasture.create({ data: { ...dto, farmId } });
  }

  findAll(farmId: string) {
    return this.prisma.pasture.findMany({ where: { farmId } });
  }

  async findOne(farmId: string, pastureId: string) {
    const pasture = await this.prisma.pasture.findUnique({
      where: { id: pastureId },
      include: { occupations: { orderBy: { enteredAt: 'desc' } } },
    });
    if (!pasture || pasture.farmId !== farmId) {
      throw new NotFoundException('Pasto não encontrado');
    }
    return pasture;
  }

  async update(farmId: string, pastureId: string, dto: UpdatePastureDto) {
    await this.findOne(farmId, pastureId);
    return this.prisma.pasture.update({ where: { id: pastureId }, data: dto });
  }

  async remove(farmId: string, pastureId: string) {
    await this.findOne(farmId, pastureId);
    await this.prisma.pasture.delete({ where: { id: pastureId } });
    return { success: true };
  }

  // Rotation: registers a new batch entering the pasture, respecting its animal capacity.
  async enterOccupation(
    farmId: string,
    pastureId: string,
    dto: CreateOccupationDto,
  ) {
    const pasture = await this.findOne(farmId, pastureId);

    const activeHeadCount = pasture.occupations
      .filter((o) => o.exitedAt === null)
      .reduce((sum, o) => sum + o.headCount, 0);

    if (activeHeadCount + dto.headCount > pasture.animalCapacity) {
      throw new BadRequestException(
        `Capacidade do pasto excedida: ${activeHeadCount + dto.headCount}/${pasture.animalCapacity} animais`,
      );
    }

    return this.prisma.pastureOccupation.create({
      data: { pastureId, headCount: dto.headCount, notes: dto.notes },
    });
  }

  // Rotation: registers the batch leaving the pasture (closes an active occupation).
  async exitOccupation(
    farmId: string,
    pastureId: string,
    occupationId: string,
  ) {
    await this.findOne(farmId, pastureId);

    const occupation = await this.prisma.pastureOccupation.findUnique({
      where: { id: occupationId },
    });
    if (!occupation || occupation.pastureId !== pastureId) {
      throw new NotFoundException('Ocupação não encontrada');
    }
    if (occupation.exitedAt) {
      throw new BadRequestException('Esta ocupação já foi encerrada');
    }

    return this.prisma.pastureOccupation.update({
      where: { id: occupationId },
      data: { exitedAt: new Date() },
    });
  }

  // Stocking rate across all pastures of the farm: occupied head count vs. total capacity.
  async occupancyStats(farmId: string) {
    const pastures = await this.prisma.pasture.findMany({
      where: { farmId },
      include: { occupations: { where: { exitedAt: null } } },
    });

    const totalCapacity = pastures.reduce(
      (sum, p) => sum + p.animalCapacity,
      0,
    );
    const occupiedHeadCount = pastures.reduce(
      (sum, p) => sum + p.occupations.reduce((s, o) => s + o.headCount, 0),
      0,
    );

    return {
      totalCapacity,
      occupiedHeadCount,
      occupancyRate: totalCapacity > 0 ? occupiedHeadCount / totalCapacity : 0,
    };
  }
}
