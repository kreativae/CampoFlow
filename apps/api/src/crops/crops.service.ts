import { Injectable, NotFoundException } from '@nestjs/common';
import { CropCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SoilAnalysisService } from '../soil-analysis/soil-analysis.service';
import { CreateCropCycleDto } from './dto/create-crop-cycle.dto';
import { UpdateCropCycleDto } from './dto/update-crop-cycle.dto';
import { CreateCropApplicationDto } from './dto/create-crop-application.dto';
import { UpdateCropApplicationDto } from './dto/update-crop-application.dto';
import { PlantingCalculatorDto } from './dto/planting-calculator.dto';
import {
  CROP_REFERENCES,
  findCropReference,
  monthName,
} from './crops.reference';

export type CropCycleStatus = 'PLANEJADA' | 'PLANTADA' | 'COLHIDA';

@Injectable()
export class CropsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly soilAnalysisService: SoilAnalysisService,
  ) {}

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

  private async assertCycle(farmId: string, cropCycleId: string) {
    const cycle = await this.prisma.cropCycle.findUnique({
      where: { id: cropCycleId },
    });
    if (!cycle || cycle.farmId !== farmId) {
      throw new NotFoundException('Safra não encontrada');
    }
    return cycle;
  }

  // ---- Referências de culturas ------------------------------------------
  listCropReferences() {
    return CROP_REFERENCES.map((r) => ({
      key: r.key,
      label: r.label,
      plantingMonths: r.plantingMonths,
      seedRateKgPerHa: r.seedRateKgPerHa,
      cycleDays: r.cycleDays,
      rotationGroup: r.rotationGroup,
    }));
  }

  // ---- #3 Janela de plantio (ZARC simplificado) -------------------------
  async plantingWindow(farmId: string, cropCycleId: string) {
    const cycle = await this.assertCycle(farmId, cropCycleId);
    const ref = findCropReference(cycle.cropName);
    if (!ref) {
      return {
        cropName: cycle.cropName,
        recognized: false,
        recommendedMonths: [] as number[],
        recommendedLabel: null as string | null,
        plantedMonth: cycle.plantedAt.getUTCMonth() + 1,
        withinWindow: null as boolean | null,
        note: 'Cultura sem janela de referência cadastrada. Ajuste conforme o ZARC do seu município.',
      };
    }
    const plantedMonth = cycle.plantedAt.getUTCMonth() + 1;
    const withinWindow = ref.plantingMonths.includes(plantedMonth);
    return {
      cropName: cycle.cropName,
      recognized: true,
      recommendedMonths: ref.plantingMonths,
      recommendedLabel: ref.plantingMonths.map(monthName).join(', '),
      plantedMonth,
      withinWindow,
      note: withinWindow
        ? 'Data de plantio dentro da janela recomendada (referência Centro-Sul).'
        : `Plantio em ${monthName(plantedMonth)} está fora da janela recomendada (${ref.plantingMonths
            .map(monthName)
            .join(', ')}). Confira o ZARC do seu município.`,
    };
  }

  // ---- #1 Recomendação de adubação e calagem por safra ------------------
  async fertilizerRecommendation(farmId: string, cropCycleId: string) {
    const cycle = await this.assertCycle(farmId, cropCycleId);
    const ref = findCropReference(cycle.cropName);

    let soil = null as Awaited<
      ReturnType<typeof this.prisma.soilAnalysis.findFirst>
    >;
    if (cycle.mapFeatureId) {
      soil = await this.prisma.soilAnalysis.findFirst({
        where: { farmId, mapFeatureId: cycle.mapFeatureId },
        orderBy: { collectedAt: 'desc' },
      });
    }

    const liming = soil
      ? this.soilAnalysisService.recommendation(
          soil,
          ref?.targetBaseSaturationPercent,
        )
      : null;

    const area = cycle.areaHectares ?? null;
    const fertilizer = ref
      ? {
          nitrogenKgPerHa: ref.nitrogenKgPerHa,
          phosphorusKgPerHa: ref.phosphorusKgPerHa,
          potassiumKgPerHa: ref.potassiumKgPerHa,
          nitrogenTotalKg: area
            ? Number((ref.nitrogenKgPerHa * area).toFixed(1))
            : null,
          phosphorusTotalKg: area
            ? Number((ref.phosphorusKgPerHa * area).toFixed(1))
            : null,
          potassiumTotalKg: area
            ? Number((ref.potassiumKgPerHa * area).toFixed(1))
            : null,
        }
      : null;

    const notes: string[] = [];
    if (!ref) {
      notes.push(
        'Cultura sem tabela de adubação de referência — informe as doses com seu agrônomo.',
      );
    }
    if (!soil) {
      notes.push(
        cycle.mapFeatureId
          ? 'Nenhuma análise de solo encontrada para o talhão desta safra.'
          : 'Vincule a safra a um talhão do mapa com análise de solo para a recomendação de calagem.',
      );
    }

    return {
      cropName: cycle.cropName,
      areaHectares: area,
      soilAnalysisId: soil?.id ?? null,
      soilCollectedAt: soil?.collectedAt ?? null,
      liming,
      fertilizer,
      notes,
    };
  }

  // ---- #2 Calculadora de plantio (cálculo puro) -------------------------
  plantingCalculator(dto: PlantingCalculatorDto) {
    const area = dto.areaHectares;
    const seedTotalKg = dto.seedRateKgPerHa
      ? Number((dto.seedRateKgPerHa * area).toFixed(2))
      : null;
    const seedCost =
      seedTotalKg != null && dto.seedPricePerKg != null
        ? Number((seedTotalKg * dto.seedPricePerKg).toFixed(2))
        : null;
    const fertilizerTotalKg = dto.fertilizerKgPerHa
      ? Number((dto.fertilizerKgPerHa * area).toFixed(2))
      : null;
    const fertilizerCost =
      fertilizerTotalKg != null && dto.fertilizerPricePerKg != null
        ? Number((fertilizerTotalKg * dto.fertilizerPricePerKg).toFixed(2))
        : null;
    const totalCost =
      seedCost != null || fertilizerCost != null
        ? Number(((seedCost ?? 0) + (fertilizerCost ?? 0)).toFixed(2))
        : null;
    const costPerHa =
      totalCost != null && area > 0
        ? Number((totalCost / area).toFixed(2))
        : null;

    return {
      areaHectares: area,
      seedTotalKg,
      seedCost,
      fertilizerTotalKg,
      fertilizerCost,
      totalCost,
      costPerHa,
    };
  }

  // ---- #6 Rotação de culturas por talhão --------------------------------
  async rotation(farmId: string) {
    const cycles = await this.prisma.cropCycle.findMany({
      where: { farmId, mapFeatureId: { not: null } },
      orderBy: { plantedAt: 'desc' },
      include: { mapFeature: { select: { id: true, name: true } } },
    });

    const groups = new Map<
      string,
      { mapFeatureId: string; label: string; cycles: typeof cycles }
    >();
    for (const cycle of cycles) {
      const key = cycle.mapFeatureId!;
      if (!groups.has(key)) {
        groups.set(key, {
          mapFeatureId: key,
          label: cycle.mapFeature?.name ?? 'Talhão',
          cycles: [],
        });
      }
      groups.get(key)!.cycles.push(cycle);
    }

    return Array.from(groups.values()).map((group) => {
      const [last, previous] = group.cycles;
      let advice =
        'Sem plantio anterior registrado neste talhão para comparar rotação.';
      if (last && previous) {
        const lastRef = findCropReference(last.cropName);
        const prevRef = findCropReference(previous.cropName);
        const sameGroup =
          lastRef && prevRef && lastRef.rotationGroup === prevRef.rotationGroup;
        advice = sameGroup
          ? `Atenção: ${previous.cropName} e ${last.cropName} são do mesmo grupo (${lastRef.rotationGroup.toLowerCase()}). Considere alternar com outro grupo para quebrar o ciclo de pragas/doenças.`
          : `Boa rotação: ${previous.cropName} → ${last.cropName} alternam grupos de cultura.`;
      }
      return {
        mapFeatureId: group.mapFeatureId,
        label: group.label,
        history: group.cycles.map((c) => ({
          id: c.id,
          cropName: c.cropName,
          variety: c.variety,
          plantedAt: c.plantedAt,
          harvestedAt: c.harvestedAt,
        })),
        advice,
      };
    });
  }

  // ---- #4 Caderno de campo (aplicações) ---------------------------------
  async listApplications(farmId: string, cropCycleId: string) {
    await this.assertCycle(farmId, cropCycleId);
    return this.prisma.cropApplication.findMany({
      where: { cropCycleId },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async addApplication(
    farmId: string,
    cropCycleId: string,
    dto: CreateCropApplicationDto,
  ) {
    await this.assertCycle(farmId, cropCycleId);
    return this.prisma.cropApplication.create({
      data: {
        farmId,
        cropCycleId,
        type: dto.type,
        product: dto.product,
        dosePerHa: dto.dosePerHa,
        doseUnit: dto.doseUnit,
        totalQuantity: dto.totalQuantity,
        appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : undefined,
        preHarvestIntervalDays: dto.preHarvestIntervalDays,
        responsible: dto.responsible,
        notes: dto.notes,
      },
    });
  }

  private async assertApplication(cropCycleId: string, applicationId: string) {
    const app = await this.prisma.cropApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app || app.cropCycleId !== cropCycleId) {
      throw new NotFoundException(
        'Registro do caderno de campo não encontrado',
      );
    }
    return app;
  }

  async updateApplication(
    farmId: string,
    cropCycleId: string,
    applicationId: string,
    dto: UpdateCropApplicationDto,
  ) {
    await this.assertCycle(farmId, cropCycleId);
    await this.assertApplication(cropCycleId, applicationId);
    return this.prisma.cropApplication.update({
      where: { id: applicationId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.product !== undefined ? { product: dto.product } : {}),
        ...(dto.dosePerHa !== undefined ? { dosePerHa: dto.dosePerHa } : {}),
        ...(dto.doseUnit !== undefined ? { doseUnit: dto.doseUnit } : {}),
        ...(dto.totalQuantity !== undefined
          ? { totalQuantity: dto.totalQuantity }
          : {}),
        ...(dto.appliedAt !== undefined
          ? { appliedAt: new Date(dto.appliedAt) }
          : {}),
        ...(dto.preHarvestIntervalDays !== undefined
          ? { preHarvestIntervalDays: dto.preHarvestIntervalDays }
          : {}),
        ...(dto.responsible !== undefined
          ? { responsible: dto.responsible }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async removeApplication(
    farmId: string,
    cropCycleId: string,
    applicationId: string,
  ) {
    await this.assertCycle(farmId, cropCycleId);
    await this.assertApplication(cropCycleId, applicationId);
    await this.prisma.cropApplication.delete({ where: { id: applicationId } });
    return { success: true };
  }
}
