import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnimalEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { TransferAnimalDto } from './dto/transfer-animal.dto';
import { MoveAnimalsDto } from './dto/move-animals.dto';

@Injectable()
export class AnimalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(farmId: string, dto: CreateAnimalDto) {
    if (dto.pastureId) {
      await this.assertPastureBelongsToFarm(farmId, dto.pastureId);
    }

    try {
      return await this.prisma.animal.create({
        data: {
          ...dto,
          farmId,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe um animal com este brinco nesta propriedade',
        );
      }
      throw error;
    }
  }

  findAll(farmId: string) {
    return this.prisma.animal.findMany({ where: { farmId, active: true } });
  }

  async findOne(farmId: string, animalId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
    });
    if (!animal || animal.farmId !== farmId) {
      throw new NotFoundException('Animal não encontrado');
    }
    return animal;
  }

  async update(farmId: string, animalId: string, dto: UpdateAnimalDto) {
    await this.findOne(farmId, animalId);
    if (dto.pastureId) {
      await this.assertPastureBelongsToFarm(farmId, dto.pastureId);
    }

    return this.prisma.animal.update({
      where: { id: animalId },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });
  }

  async remove(farmId: string, animalId: string) {
    await this.findOne(farmId, animalId);
    await this.prisma.animal.update({
      where: { id: animalId },
      data: { active: false },
    });
    return { success: true };
  }

  // Moves the animal to another pasture and/or property, logging the move as a history event.
  async transfer(farmId: string, animalId: string, dto: TransferAnimalDto) {
    const animal = await this.findOne(farmId, animalId);
    const targetFarmId = dto.targetFarmId ?? farmId;

    if (dto.targetFarmId && dto.targetFarmId !== farmId) {
      const targetFarm = await this.prisma.farm.findUnique({
        where: { id: dto.targetFarmId },
      });
      if (!targetFarm) {
        throw new NotFoundException('Propriedade de destino não encontrada');
      }
    }

    if (dto.pastureId) {
      await this.assertPastureBelongsToFarm(targetFarmId, dto.pastureId);
    }

    if (!dto.pastureId && dto.targetFarmId === undefined) {
      throw new BadRequestException(
        'Informe um pasto e/ou propriedade de destino',
      );
    }

    const updated = await this.prisma.animal.update({
      where: { id: animalId },
      data: { farmId: targetFarmId, pastureId: dto.pastureId ?? null },
    });

    await this.prisma.animalEvent.create({
      data: {
        animalId,
        type: AnimalEventType.TRANSFER,
        description: `Transferido de pasto ${animal.pastureId ?? '-'} / fazenda ${animal.farmId} para pasto ${dto.pastureId ?? '-'} / fazenda ${targetFarmId}`,
        metadata: {
          fromFarmId: animal.farmId,
          fromPastureId: animal.pastureId,
          toFarmId: targetFarmId,
          toPastureId: dto.pastureId ?? null,
        },
      },
    });

    return updated;
  }

  // Moves one or several ear tags to another pasture within the same farm at once,
  // logging a move event for each animal.
  async moveToPasture(farmId: string, dto: MoveAnimalsDto) {
    const targetPastureId = dto.pastureId ?? null;
    if (targetPastureId) {
      await this.assertPastureBelongsToFarm(farmId, targetPastureId);
    }

    const animals = await this.prisma.animal.findMany({
      where: { id: { in: dto.animalIds }, farmId, active: true },
    });
    if (animals.length !== dto.animalIds.length) {
      throw new NotFoundException(
        'Um ou mais animais não foram encontrados nesta propriedade',
      );
    }

    await this.prisma.$transaction([
      this.prisma.animal.updateMany({
        where: { id: { in: dto.animalIds }, farmId },
        data: { pastureId: targetPastureId },
      }),
      this.prisma.animalEvent.createMany({
        data: animals.map((animal) => ({
          animalId: animal.id,
          type: AnimalEventType.TRANSFER,
          description: `Movido de pasto ${animal.pastureId ?? '-'} para pasto ${targetPastureId ?? '-'}`,
          metadata: {
            fromPastureId: animal.pastureId,
            toPastureId: targetPastureId,
          },
        })),
      }),
    ]);

    return { moved: animals.length, pastureId: targetPastureId };
  }

  async history(farmId: string, animalId: string) {
    await this.findOne(farmId, animalId);
    return this.prisma.animalEvent.findMany({
      where: { animalId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  private async assertPastureBelongsToFarm(farmId: string, pastureId: string) {
    const pasture = await this.prisma.pasture.findUnique({
      where: { id: pastureId },
    });
    if (!pasture || pasture.farmId !== farmId) {
      throw new BadRequestException(
        'Pasto informado não pertence a esta propriedade',
      );
    }
  }
}
