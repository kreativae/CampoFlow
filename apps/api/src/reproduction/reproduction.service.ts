import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AnimalEventType,
  PregnancyDiagnosisResult,
  ReproductiveEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReproductiveEventDto } from './dto/create-reproductive-event.dto';

const BREEDING_EVENT_TYPES: ReproductiveEventType[] = [
  ReproductiveEventType.IATF,
  ReproductiveEventType.MONTA_NATURAL,
  ReproductiveEventType.INSEMINACAO,
];

@Injectable()
export class ReproductionService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAnimalBelongsToFarm(farmId: string, animalId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
    });
    if (!animal || animal.farmId !== farmId) {
      throw new NotFoundException('Animal não encontrado');
    }
  }

  async create(
    farmId: string,
    animalId: string,
    dto: CreateReproductiveEventDto,
  ) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);

    const eventDate = dto.eventDate ? new Date(dto.eventDate) : new Date();
    const record = await this.prisma.reproductiveEvent.create({
      data: {
        animalId,
        type: dto.type,
        eventDate,
        result: dto.result,
        notes: dto.notes,
      },
    });

    await this.prisma.animalEvent.create({
      data: {
        animalId,
        type: AnimalEventType.REPRODUCTIVE,
        occurredAt: eventDate,
        description: `${dto.type}${dto.result ? ` (${dto.result})` : ''}`,
        metadata: { reproductiveEventId: record.id },
      },
    });

    return record;
  }

  async listForAnimal(farmId: string, animalId: string) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);
    return this.prisma.reproductiveEvent.findMany({
      where: { animalId },
      orderBy: { eventDate: 'desc' },
    });
  }

  // Farm-level reproductive KPIs: conception rate, pregnancy rate, births, abortions.
  async stats(farmId: string) {
    const events = await this.prisma.reproductiveEvent.findMany({
      where: { animal: { farmId } },
    });

    const breedingEvents = events.filter((e) =>
      BREEDING_EVENT_TYPES.includes(e.type),
    ).length;
    const diagnoses = events.filter(
      (e) => e.type === ReproductiveEventType.DIAGNOSTICO_PRENHEZ,
    );
    const confirmedPregnant = diagnoses.filter(
      (e) => e.result === PregnancyDiagnosisResult.PRENHE,
    ).length;
    const births = events.filter(
      (e) => e.type === ReproductiveEventType.PARTO,
    ).length;
    const abortions = events.filter(
      (e) => e.type === ReproductiveEventType.ABORTO,
    ).length;

    return {
      breedingEvents,
      pregnancyDiagnoses: diagnoses.length,
      confirmedPregnant,
      conceptionRate:
        breedingEvents > 0 ? confirmedPregnant / breedingEvents : 0,
      pregnancyRate:
        diagnoses.length > 0 ? confirmedPregnant / diagnoses.length : 0,
      births,
      abortions,
    };
  }
}
