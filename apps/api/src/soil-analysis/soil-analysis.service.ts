import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { SoilAnalysis } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { CreateSoilAnalysisDto } from './dto/create-soil-analysis.dto';
import { UpdateSoilAnalysisDto } from './dto/update-soil-analysis.dto';

const DEFAULT_TARGET_BASE_SATURATION = 70;
// 1 cmolc/dm³ of base saturation deficit ≈ 1 t/ha of limestone (PRNT 100%) for the
// standard 0-20cm sampling layer — the widely-used simplification in Brazilian
// extension material for the "método da saturação por bases". Real recommendations
// should still also weigh crop, PRNT of the product actually available, and soil
// depth; this is a heuristic starting point, not a replacement for agronomist review.
const CMOLC_TO_TON_PER_HECTARE = 1;

export interface SoilAnalysisRecommendation {
  limingNeeded: boolean;
  limestoneTonPerHa: number | null;
  targetBaseSaturationPercent: number;
  notes: string[];
}

@Injectable()
export class SoilAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    farmId: string,
    createdById: string,
    dto: CreateSoilAnalysisDto,
    file?: Express.Multer.File,
  ) {
    if (dto.mapFeatureId) {
      const feature = await this.prisma.mapFeature.findUnique({
        where: { id: dto.mapFeatureId },
      });
      if (!feature || feature.farmId !== farmId) {
        throw new NotFoundException('Elemento do mapa não encontrado');
      }
    }

    let documentPath: string | undefined;
    let documentFileName: string | undefined;
    if (file) {
      documentPath = `${farmId}/solo/${randomUUID()}${extname(file.originalname)}`;
      await this.storageService.upload(
        documentPath,
        file.buffer,
        file.mimetype,
      );
      documentFileName = file.originalname;
    }

    return this.prisma.soilAnalysis.create({
      data: {
        farmId,
        mapFeatureId: dto.mapFeatureId,
        areaLabel: dto.areaLabel,
        collectedAt: new Date(dto.collectedAt),
        ph: dto.ph,
        phosphorusMgDm3: dto.phosphorusMgDm3,
        potassiumCmolcDm3: dto.potassiumCmolcDm3,
        calciumCmolcDm3: dto.calciumCmolcDm3,
        magnesiumCmolcDm3: dto.magnesiumCmolcDm3,
        aluminumCmolcDm3: dto.aluminumCmolcDm3,
        organicMatterPercent: dto.organicMatterPercent,
        baseSaturationPercent: dto.baseSaturationPercent,
        ctcCmolcDm3: dto.ctcCmolcDm3,
        documentPath,
        documentFileName,
        notes: dto.notes,
        createdById,
      },
    });
  }

  findAll(farmId: string, mapFeatureId?: string) {
    return this.prisma.soilAnalysis.findMany({
      where: { farmId, ...(mapFeatureId ? { mapFeatureId } : {}) },
      orderBy: { collectedAt: 'desc' },
    });
  }

  async findOne(farmId: string, id: string) {
    const analysis = await this.prisma.soilAnalysis.findUnique({
      where: { id },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
    });
    if (!analysis || analysis.farmId !== farmId) {
      throw new NotFoundException('Análise de solo não encontrada');
    }
    return analysis;
  }

  async update(farmId: string, id: string, dto: UpdateSoilAnalysisDto) {
    await this.findOne(farmId, id);
    return this.prisma.soilAnalysis.update({
      where: { id },
      data: {
        ...(dto.areaLabel !== undefined ? { areaLabel: dto.areaLabel } : {}),
        ...(dto.collectedAt !== undefined
          ? { collectedAt: new Date(dto.collectedAt) }
          : {}),
        ...(dto.ph !== undefined ? { ph: dto.ph } : {}),
        ...(dto.phosphorusMgDm3 !== undefined
          ? { phosphorusMgDm3: dto.phosphorusMgDm3 }
          : {}),
        ...(dto.potassiumCmolcDm3 !== undefined
          ? { potassiumCmolcDm3: dto.potassiumCmolcDm3 }
          : {}),
        ...(dto.calciumCmolcDm3 !== undefined
          ? { calciumCmolcDm3: dto.calciumCmolcDm3 }
          : {}),
        ...(dto.magnesiumCmolcDm3 !== undefined
          ? { magnesiumCmolcDm3: dto.magnesiumCmolcDm3 }
          : {}),
        ...(dto.aluminumCmolcDm3 !== undefined
          ? { aluminumCmolcDm3: dto.aluminumCmolcDm3 }
          : {}),
        ...(dto.organicMatterPercent !== undefined
          ? { organicMatterPercent: dto.organicMatterPercent }
          : {}),
        ...(dto.baseSaturationPercent !== undefined
          ? { baseSaturationPercent: dto.baseSaturationPercent }
          : {}),
        ...(dto.ctcCmolcDm3 !== undefined
          ? { ctcCmolcDm3: dto.ctcCmolcDm3 }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async remove(farmId: string, id: string) {
    const analysis = await this.findOne(farmId, id);
    const photos = await this.prisma.soilAnalysisPhoto.findMany({
      where: { soilAnalysisId: id },
    });
    await this.prisma.soilAnalysis.delete({ where: { id } });
    if (analysis.documentPath) {
      await this.storageService.delete(analysis.documentPath);
    }
    await Promise.all(
      photos.map((p) => this.storageService.delete(p.storagePath)),
    );
    return { success: true };
  }

  // History for a single area (mapFeatureId), oldest first, so the web UI can chart
  // how each indicator evolved across collections.
  history(farmId: string, mapFeatureId: string) {
    return this.prisma.soilAnalysis.findMany({
      where: { farmId, mapFeatureId },
      orderBy: { collectedAt: 'asc' },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
    });
  }

  // Simplified agronomic recommendation, computed on the fly (not stored) — same
  // "no ML/specialist system available" substitution pattern as the BI module.
  recommendation(
    analysis: SoilAnalysis,
    targetBaseSaturationPercent = DEFAULT_TARGET_BASE_SATURATION,
  ): SoilAnalysisRecommendation {
    const notes: string[] = [];
    let limestoneTonPerHa: number | null = null;

    if (
      analysis.baseSaturationPercent != null &&
      analysis.ctcCmolcDm3 != null
    ) {
      const deficitPercent =
        targetBaseSaturationPercent - analysis.baseSaturationPercent;
      const ncCmolc = (analysis.ctcCmolcDm3 * deficitPercent) / 100;
      limestoneTonPerHa = Math.max(
        0,
        Number((ncCmolc * CMOLC_TO_TON_PER_HECTARE).toFixed(2)),
      );
    } else {
      notes.push(
        'Informe CTC e saturação de bases (V%) para calcular a necessidade de calagem.',
      );
    }

    if (analysis.ph != null) {
      if (analysis.ph < 5.0) {
        notes.push(
          'pH baixo (solo ácido) — calagem é recomendada antes de outras correções.',
        );
      } else if (analysis.ph > 6.8) {
        notes.push('pH elevado — avalie se a calagem ainda é necessária.');
      }
    }

    if (analysis.phosphorusMgDm3 != null && analysis.phosphorusMgDm3 < 10) {
      notes.push('Fósforo (P) baixo — considere adubação fosfatada.');
    }

    if (
      analysis.potassiumCmolcDm3 != null &&
      analysis.potassiumCmolcDm3 < 0.15
    ) {
      notes.push('Potássio (K) baixo — considere adubação potássica.');
    }

    if (
      analysis.organicMatterPercent != null &&
      analysis.organicMatterPercent < 1.5
    ) {
      notes.push(
        'Matéria orgânica baixa — práticas de manejo (rotação, cobertura) podem ajudar.',
      );
    }

    if (notes.length === 0) {
      notes.push(
        'Indicadores dentro de faixas consideradas adequadas pela heurística.',
      );
    }

    return {
      limingNeeded: (limestoneTonPerHa ?? 0) > 0,
      limestoneTonPerHa,
      targetBaseSaturationPercent,
      notes,
    };
  }

  async downloadDocument(farmId: string, id: string) {
    const analysis = await this.findOne(farmId, id);
    if (!analysis.documentPath || !analysis.documentFileName) {
      throw new NotFoundException(
        'Esta análise não possui laudo em PDF anexado',
      );
    }
    return {
      path: analysis.documentPath,
      fileName: analysis.documentFileName,
    };
  }

  async uploadPhotos(
    farmId: string,
    analysisId: string,
    files: Express.Multer.File[],
    metadata: {
      takenAt?: string;
      latitude?: number;
      longitude?: number;
      caption?: string;
    }[],
  ) {
    await this.findOne(farmId, analysisId);

    const created = await Promise.all(
      files.map(async (file, i) => {
        const meta = metadata[i] ?? {};
        const storagePath = `${farmId}/solo/fotos/${randomUUID()}${extname(file.originalname)}`;
        await this.storageService.upload(
          storagePath,
          file.buffer,
          file.mimetype,
        );

        return this.prisma.soilAnalysisPhoto.create({
          data: {
            soilAnalysisId: analysisId,
            storagePath,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            takenAt: meta.takenAt ? new Date(meta.takenAt) : null,
            latitude: meta.latitude ?? null,
            longitude: meta.longitude ?? null,
            caption: meta.caption ?? null,
          },
        });
      }),
    );

    return created;
  }

  async listPhotos(farmId: string, analysisId: string) {
    await this.findOne(farmId, analysisId);
    return this.prisma.soilAnalysisPhoto.findMany({
      where: { soilAnalysisId: analysisId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPhoto(farmId: string, analysisId: string, photoId: string) {
    await this.findOne(farmId, analysisId);
    const photo = await this.prisma.soilAnalysisPhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.soilAnalysisId !== analysisId) {
      throw new NotFoundException('Foto não encontrada');
    }
    return photo;
  }

  async deletePhoto(farmId: string, analysisId: string, photoId: string) {
    const photo = await this.getPhoto(farmId, analysisId, photoId);
    await this.prisma.soilAnalysisPhoto.delete({ where: { id: photoId } });
    await this.storageService.delete(photo.storagePath);
    return { success: true };
  }
}
