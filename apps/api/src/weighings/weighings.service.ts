import { Injectable, NotFoundException } from '@nestjs/common';
import { AnimalEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeighingDto } from './dto/create-weighing.dto';

const DAYS_PER_MONTH = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Injectable()
export class WeighingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAnimalBelongsToFarm(farmId: string, animalId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
    });
    if (!animal || animal.farmId !== farmId) {
      throw new NotFoundException('Animal não encontrado');
    }
  }

  async create(farmId: string, animalId: string, dto: CreateWeighingDto) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);

    const weighedAt = dto.weighedAt ? new Date(dto.weighedAt) : new Date();
    const [record] = await this.prisma.$transaction([
      this.prisma.weighingRecord.create({
        data: { animalId, weightKg: dto.weightKg, weighedAt, notes: dto.notes },
      }),
      this.prisma.animal.update({
        where: { id: animalId },
        data: { currentWeightKg: dto.weightKg },
      }),
      this.prisma.animalEvent.create({
        data: {
          animalId,
          type: AnimalEventType.WEIGHING,
          occurredAt: weighedAt,
          description: `Pesagem: ${dto.weightKg}kg`,
        },
      }),
    ]);

    return record;
  }

  async list(farmId: string, animalId: string) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);
    return this.prisma.weighingRecord.findMany({
      where: { animalId },
      orderBy: { weighedAt: 'asc' },
    });
  }

  // Average daily/monthly weight gain computed from consecutive weighings.
  async gainSummary(farmId: string, animalId: string) {
    const weighings = await this.list(farmId, animalId);

    if (weighings.length < 2) {
      return {
        averageDailyGainKg: 0,
        averageMonthlyGainKg: 0,
        weighingsCount: weighings.length,
      };
    }

    let totalGainKg = 0;
    let totalDays = 0;
    for (let i = 1; i < weighings.length; i++) {
      const prev = weighings[i - 1];
      const curr = weighings[i];
      const days =
        (curr.weighedAt.getTime() - prev.weighedAt.getTime()) / MS_PER_DAY;
      if (days > 0) {
        totalGainKg += curr.weightKg - prev.weightKg;
        totalDays += days;
      }
    }

    const averageDailyGainKg = totalDays > 0 ? totalGainKg / totalDays : 0;

    return {
      averageDailyGainKg: Number(averageDailyGainKg.toFixed(3)),
      averageMonthlyGainKg: Number(
        (averageDailyGainKg * DAYS_PER_MONTH).toFixed(3),
      ),
      weighingsCount: weighings.length,
    };
  }
}
