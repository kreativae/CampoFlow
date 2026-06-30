import { Injectable, NotFoundException } from '@nestjs/common';
import { AnimalEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { ApplyVaccinationDto } from './dto/apply-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { CreateTreatmentDto } from './dto/create-treatment.dto';

const UPCOMING_VACCINATION_WINDOW_DAYS = 7;

@Injectable()
export class HealthRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAnimalBelongsToFarm(farmId: string, animalId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
    });
    if (!animal || animal.farmId !== farmId) {
      throw new NotFoundException('Animal não encontrado');
    }
    return animal;
  }

  async scheduleVaccination(
    farmId: string,
    animalId: string,
    dto: CreateVaccinationDto,
  ) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);

    const record = await this.prisma.vaccinationRecord.create({
      data: {
        animalId,
        vaccineName: dto.vaccineName,
        scheduledDate: new Date(dto.scheduledDate),
        administeredAt: dto.administeredAt
          ? new Date(dto.administeredAt)
          : undefined,
        batchNumber: dto.batchNumber,
        administeredBy: dto.administeredBy,
        notes: dto.notes,
      },
    });

    await this.prisma.animalEvent.create({
      data: {
        animalId,
        type: AnimalEventType.VACCINATION,
        occurredAt: record.scheduledDate,
        description: `Vacina agendada: ${dto.vaccineName}`,
        metadata: { vaccinationRecordId: record.id },
      },
    });

    return record;
  }

  async listVaccinations(farmId: string, animalId: string) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);
    return this.prisma.vaccinationRecord.findMany({
      where: { animalId },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  async applyVaccination(
    farmId: string,
    animalId: string,
    vaccinationId: string,
    dto: ApplyVaccinationDto,
  ) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);
    const record = await this.prisma.vaccinationRecord.findUnique({
      where: { id: vaccinationId },
    });
    if (!record || record.animalId !== animalId) {
      throw new NotFoundException('Registro de vacinação não encontrado');
    }

    return this.prisma.vaccinationRecord.update({
      where: { id: vaccinationId },
      data: {
        administeredAt: dto.administeredAt
          ? new Date(dto.administeredAt)
          : new Date(),
        batchNumber: dto.batchNumber ?? record.batchNumber,
        administeredBy: dto.administeredBy ?? record.administeredBy,
      },
    });
  }

  // General edit, distinct from applyVaccination() — lets staff fix a typo'd
  // scheduledDate/administeredAt or vaccine name after the fact, without the
  // "mark as applied" semantics that endpoint carries.
  async updateVaccination(
    farmId: string,
    animalId: string,
    vaccinationId: string,
    dto: UpdateVaccinationDto,
  ) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);
    const record = await this.prisma.vaccinationRecord.findUnique({
      where: { id: vaccinationId },
    });
    if (!record || record.animalId !== animalId) {
      throw new NotFoundException('Registro de vacinação não encontrado');
    }

    return this.prisma.vaccinationRecord.update({
      where: { id: vaccinationId },
      data: {
        ...(dto.vaccineName !== undefined
          ? { vaccineName: dto.vaccineName }
          : {}),
        ...(dto.scheduledDate !== undefined
          ? { scheduledDate: new Date(dto.scheduledDate) }
          : {}),
        ...(dto.administeredAt !== undefined
          ? { administeredAt: new Date(dto.administeredAt) }
          : {}),
        ...(dto.batchNumber !== undefined
          ? { batchNumber: dto.batchNumber }
          : {}),
        ...(dto.administeredBy !== undefined
          ? { administeredBy: dto.administeredBy }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async createTreatment(
    farmId: string,
    animalId: string,
    dto: CreateTreatmentDto,
  ) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);

    const record = await this.prisma.treatmentRecord.create({
      data: {
        animalId,
        diagnosis: dto.diagnosis,
        medication: dto.medication,
        dosage: dto.dosage,
        treatmentDate: dto.treatmentDate
          ? new Date(dto.treatmentDate)
          : undefined,
        administeredBy: dto.administeredBy,
        notes: dto.notes,
      },
    });

    await this.prisma.animalEvent.create({
      data: {
        animalId,
        type: AnimalEventType.TREATMENT,
        occurredAt: record.treatmentDate,
        description: `Tratamento: ${dto.medication}`,
        metadata: { treatmentRecordId: record.id },
      },
    });

    return record;
  }

  async listTreatments(farmId: string, animalId: string) {
    await this.assertAnimalBelongsToFarm(farmId, animalId);
    return this.prisma.treatmentRecord.findMany({
      where: { animalId },
      orderBy: { treatmentDate: 'desc' },
    });
  }

  // Farm-wide vaccination records (all animals), used by the herd list page to filter
  // animals by vaccination status (aplicada vs. agendada).
  listAllForFarm(farmId: string) {
    return this.prisma.vaccinationRecord.findMany({
      where: { animal: { farmId } },
      select: { animalId: true, administeredAt: true },
    });
  }

  // Pending alerts for the whole farm: vaccinations not yet administered, due within the window
  // or already overdue.
  async pendingAlerts(farmId: string) {
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + UPCOMING_VACCINATION_WINDOW_DAYS);

    const pendingVaccinations = await this.prisma.vaccinationRecord.findMany({
      where: {
        administeredAt: null,
        scheduledDate: { lte: windowEnd },
        animal: { farmId },
      },
      include: { animal: { select: { earTag: true, name: true } } },
      orderBy: { scheduledDate: 'asc' },
    });

    const now = new Date();
    return pendingVaccinations.map((v) => ({
      id: v.id,
      animalId: v.animalId,
      animalEarTag: v.animal.earTag,
      vaccineName: v.vaccineName,
      scheduledDate: v.scheduledDate,
      overdue: v.scheduledDate < now,
    }));
  }
}
