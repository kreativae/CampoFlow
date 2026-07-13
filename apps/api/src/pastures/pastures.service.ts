import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePastureDto } from './dto/create-pasture.dto';
import { UpdatePastureDto } from './dto/update-pasture.dto';
import { CreateOccupationDto } from './dto/create-occupation.dto';
import { RegisterExitDto } from './dto/register-exit.dto';
import { UpdateOccupationDto } from './dto/update-occupation.dto';

@Injectable()
export class PasturesService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreatePastureDto) {
    return this.prisma.pasture.create({ data: { ...dto, farmId } });
  }

  // Includes active occupations (manual rotation batches) and the live head count
  // of animals assigned to the pasture in the herd module, so the list view can
  // show "X/Y animais" reflecting real animal→pasture assignments.
  async findAll(farmId: string) {
    const pastures = await this.prisma.pasture.findMany({
      where: { farmId },
      include: {
        occupations: { where: { exitedAt: null } },
        _count: { select: { animals: { where: { active: true } } } },
      },
    });
    return pastures.map(({ _count, ...pasture }) => ({
      ...pasture,
      animalHeadCount: _count.animals,
    }));
  }

  async findOne(farmId: string, pastureId: string) {
    const pasture = await this.prisma.pasture.findUnique({
      where: { id: pastureId },
      include: {
        occupations: { orderBy: { enteredAt: 'desc' } },
        animals: { where: { active: true }, orderBy: { earTag: 'asc' } },
      },
    });
    if (!pasture || pasture.farmId !== farmId) {
      throw new NotFoundException('Pasto não encontrado');
    }
    return { ...pasture, animalHeadCount: pasture.animals.length };
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

  // Rotation: registers the batch (or part of it) leaving the pasture. A partial
  // headCount splits the occupation in two: the original keeps the remaining head
  // and stays active, while a new closed record captures the portion that left —
  // so headCount math and history both stay consistent. Optionally also opens a
  // matching entry occupation in destinationPastureId, so a "move between
  // pastures" reads as a paired exit+entry rather than the batch vanishing.
  async exitOccupation(
    farmId: string,
    pastureId: string,
    occupationId: string,
    dto: RegisterExitDto,
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

    const exitingHeadCount = dto.headCount ?? occupation.headCount;
    if (exitingHeadCount > occupation.headCount) {
      throw new BadRequestException(
        `Quantidade de saída (${exitingHeadCount}) maior que o lote atual (${occupation.headCount})`,
      );
    }
    const exitedAt = dto.exitedAt ? new Date(dto.exitedAt) : new Date();

    let exitedOccupation: typeof occupation;
    if (exitingHeadCount === occupation.headCount) {
      exitedOccupation = await this.prisma.pastureOccupation.update({
        where: { id: occupationId },
        data: { exitedAt, notes: dto.notes ?? occupation.notes },
      });
    } else {
      await this.prisma.pastureOccupation.update({
        where: { id: occupationId },
        data: { headCount: occupation.headCount - exitingHeadCount },
      });
      exitedOccupation = await this.prisma.pastureOccupation.create({
        data: {
          pastureId,
          headCount: exitingHeadCount,
          enteredAt: occupation.enteredAt,
          exitedAt,
          notes: dto.notes,
        },
      });
    }

    if (dto.destinationPastureId) {
      const destination = await this.findOne(farmId, dto.destinationPastureId);
      const activeHeadCount = destination.occupations
        .filter((o) => o.exitedAt === null)
        .reduce((sum, o) => sum + o.headCount, 0);
      if (activeHeadCount + exitingHeadCount > destination.animalCapacity) {
        throw new BadRequestException(
          `Capacidade do pasto de destino excedida: ${activeHeadCount + exitingHeadCount}/${destination.animalCapacity} animais`,
        );
      }
      await this.prisma.pastureOccupation.create({
        data: {
          pastureId: dto.destinationPastureId,
          headCount: exitingHeadCount,
          enteredAt: exitedAt,
          notes: `Recebido do pasto anterior`,
        },
      });
    }

    return exitedOccupation;
  }

  // Direct edit of an occupation record (e.g. fixing a wrong exit date or headCount
  // after the fact) — distinct from exitOccupation()'s "close it now" flow.
  async updateOccupation(
    farmId: string,
    pastureId: string,
    occupationId: string,
    dto: UpdateOccupationDto,
  ) {
    await this.findOne(farmId, pastureId);

    const occupation = await this.prisma.pastureOccupation.findUnique({
      where: { id: occupationId },
    });
    if (!occupation || occupation.pastureId !== pastureId) {
      throw new NotFoundException('Ocupação não encontrada');
    }

    return this.prisma.pastureOccupation.update({
      where: { id: occupationId },
      data: {
        ...(dto.headCount !== undefined ? { headCount: dto.headCount } : {}),
        ...(dto.enteredAt !== undefined
          ? { enteredAt: new Date(dto.enteredAt) }
          : {}),
        ...(dto.exitedAt !== undefined
          ? { exitedAt: new Date(dto.exitedAt) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async removeOccupation(
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

    return this.prisma.pastureOccupation.delete({
      where: { id: occupationId },
    });
  }

  // Stocking rate across all pastures of the farm: occupied head count vs. total
  // capacity. Occupancy is driven by real animals assigned to each pasture in the
  // herd module, so it stays in sync with animal→pasture moves.
  async occupancyStats(farmId: string) {
    const pastures = await this.prisma.pasture.findMany({
      where: { farmId },
      include: {
        _count: { select: { animals: { where: { active: true } } } },
      },
    });

    const totalCapacity = pastures.reduce(
      (sum, p) => sum + p.animalCapacity,
      0,
    );
    const occupiedHeadCount = pastures.reduce(
      (sum, p) => sum + p._count.animals,
      0,
    );

    return {
      totalCapacity,
      occupiedHeadCount,
      occupancyRate: totalCapacity > 0 ? occupiedHeadCount / totalCapacity : 0,
    };
  }
}
