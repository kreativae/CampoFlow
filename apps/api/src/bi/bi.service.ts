import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalsService } from '../animals/animals.service';
import { WeighingsService } from '../weighings/weighings.service';
import { FinanceService } from '../finance/finance.service';
import { PasturesService } from '../pastures/pastures.service';
import { SuppliesService } from '../supplies/supplies.service';
import { AgendaService } from '../agenda/agenda.service';
import { HealthRecordsService } from '../health-records/health-records.service';
import { WeatherService } from '../weather/weather.service';
import { QuotationsService } from '../quotations/quotations.service';
import { MachinesService } from '../machines/machines.service';
import { SoilAnalysisService } from '../soil-analysis/soil-analysis.service';
import { DocumentsService } from '../documents/documents.service';

const KG_PER_ARROBA = 15;
const FORECAST_WINDOW_DAYS = 30;
const MIN_WEIGHINGS_FOR_GAIN = 2;
const WEATHER_RISK_REDUCTION = 0.85; // -15% projected gain when an active weather alert exists
const HIGH_OCCUPANCY_THRESHOLD = 0.9;

@Injectable()
export class BiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animalsService: AnimalsService,
    private readonly weighingsService: WeighingsService,
    private readonly financeService: FinanceService,
    private readonly pasturesService: PasturesService,
    private readonly suppliesService: SuppliesService,
    private readonly agendaService: AgendaService,
    private readonly healthRecordsService: HealthRecordsService,
    private readonly weatherService: WeatherService,
    private readonly quotationsService: QuotationsService,
    private readonly machinesService: MachinesService,
    private readonly soilAnalysisService: SoilAnalysisService,
    private readonly documentsService: DocumentsService,
  ) {}

  // Real, deterministic financial/herd KPIs — no estimation involved.
  async kpis(farmId: string) {
    const [animals, transactions] = await Promise.all([
      this.animalsService.findAll(farmId),
      this.prisma.transaction.findMany({ where: { farmId } }),
    ]);

    const totalReceita = transactions
      .filter((t) => t.type === 'RECEITA')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDespesa = transactions
      .filter((t) => t.type === 'DESPESA')
      .reduce((sum, t) => sum + t.amount, 0);

    // Arrobas produzidas: total weight gained across all weighing history, farm-wide.
    const weighings = await this.prisma.weighingRecord.findMany({
      where: { animal: { farmId } },
      orderBy: { weighedAt: 'asc' },
    });
    const byAnimal = new Map<string, number[]>();
    for (const w of weighings) {
      const list = byAnimal.get(w.animalId) ?? [];
      list.push(w.weightKg);
      byAnimal.set(w.animalId, list);
    }
    let totalGainKg = 0;
    for (const list of byAnimal.values()) {
      if (list.length >= 2) {
        totalGainKg += list[list.length - 1] - list[0];
      }
    }
    const arrobasProduzidas = Math.max(totalGainKg, 0) / KG_PER_ARROBA;

    const lucro = totalReceita - totalDespesa;

    return {
      totalReceita,
      totalDespesa,
      lucro,
      arrobasProduzidas: Number(arrobasProduzidas.toFixed(2)),
      custoPorArroba:
        arrobasProduzidas > 0
          ? Number((totalDespesa / arrobasProduzidas).toFixed(2))
          : 0,
      lucroPorAnimal:
        animals.length > 0 ? Number((lucro / animals.length).toFixed(2)) : 0,
      roi: totalDespesa > 0 ? Number((lucro / totalDespesa).toFixed(4)) : 0,
      rentabilidade:
        totalReceita > 0 ? Number((lucro / totalReceita).toFixed(4)) : 0,
    };
  }

  // Heuristic forecast: herd average daily gain extrapolated forward, discounted when an
  // active weather alert (seca, geada, etc.) is present. Not a trained ML model — there is
  // no ML/LLM infrastructure available in this environment, so this is a transparent,
  // rule-based substitute documented as such.
  async forecastWeightGain(farmId: string) {
    const animals = await this.animalsService.findAll(farmId);
    const summaries = await Promise.all(
      animals.map((a) => this.weighingsService.gainSummary(farmId, a.id)),
    );
    const valid = summaries.filter(
      (s) => s.weighingsCount >= MIN_WEIGHINGS_FOR_GAIN,
    );
    const averageDailyGainKg =
      valid.length > 0
        ? valid.reduce((sum, s) => sum + s.averageDailyGainKg, 0) / valid.length
        : 0;

    const weatherAlerts = await this.weatherService.activeAlerts(farmId);
    const weatherRisk = weatherAlerts.length > 0;

    const baseProjectedKg =
      averageDailyGainKg * animals.length * FORECAST_WINDOW_DAYS;
    const adjustedProjectedKg = weatherRisk
      ? baseProjectedKg * WEATHER_RISK_REDUCTION
      : baseProjectedKg;

    return {
      windowDays: FORECAST_WINDOW_DAYS,
      averageDailyGainKg: Number(averageDailyGainKg.toFixed(3)),
      herdSize: animals.length,
      projectedArrobas: Number((baseProjectedKg / KG_PER_ARROBA).toFixed(2)),
      weatherRiskActive: weatherRisk,
      weatherAdjustedProjectedArrobas: Number(
        (adjustedProjectedKg / KG_PER_ARROBA).toFixed(2),
      ),
    };
  }

  // Heuristic forecast: simple moving average of recent monthly revenue. Same caveat as
  // forecastWeightGain — a transparent statistical substitute, not a trained model.
  async forecastSales(farmId: string) {
    const monthly = await this.financeService.cashFlow(farmId, 'monthly');
    const recent = monthly.slice(-3);
    const projectedNextMonthReceita =
      recent.length > 0
        ? recent.reduce((sum, m) => sum + m.receita, 0) / recent.length
        : 0;

    return {
      recentMonths: recent,
      projectedNextMonthReceita: Number(projectedNextMonthReceita.toFixed(2)),
    };
  }

  // Real data pulled from modules not otherwise covered by kpis()/forecast*(): national
  // commodity quotations (to value the herd), per-machine maintenance/fuel costs, soil
  // analyses pending correction, and the farm's document count. All real numbers from
  // the database — no estimation beyond the herd-value multiplication itself.
  async additionalData(farmId: string, arrobasProduzidas: number) {
    const [latestQuotations, machineCosts, soilAnalyses, documents] =
      await Promise.all([
        this.quotationsService.latest(),
        this.machinesService.costsSummary(farmId),
        this.soilAnalysisService.findAll(farmId),
        this.documentsService.findAll(farmId),
      ]);

    const boiGordo = latestQuotations.find(
      (q) => q.commodity === 'BOI_GORDO' && q.state == null,
    );
    const valorEstimadoRebanho = boiGordo
      ? Number((arrobasProduzidas * boiGordo.price).toFixed(2))
      : null;

    const custosMaquinas = machineCosts.reduce(
      (sum, m) => sum + m.totalCost,
      0,
    );

    const areasComCalagemPendente = soilAnalyses.filter(
      (a) => this.soilAnalysisService.recommendation(a).limingNeeded,
    ).length;

    return {
      cotacaoBoiGordo: boiGordo
        ? {
            price: boiGordo.price,
            unit: boiGordo.unit,
            recordedAt: boiGordo.recordedAt,
          }
        : null,
      valorEstimadoRebanho,
      custosMaquinas: Number(custosMaquinas.toFixed(2)),
      maquinasCount: machineCosts.length,
      analisesSoloCount: soilAnalyses.length,
      areasComCalagemPendente,
      documentosCount: documents.length,
    };
  }

  // Rule-based management suggestions composed from alerts already surfaced by other
  // modules (pasture occupancy, supplies, agenda, vaccination, weather, soil). This is a
  // transparent rules engine, not generative AI — there is no LLM API key configured in
  // this environment to power real natural-language suggestions.
  async managementSuggestions(farmId: string): Promise<string[]> {
    const [
      occupancy,
      supplyAlerts,
      agendaAlerts,
      healthAlerts,
      weatherAlerts,
      soilAnalyses,
    ] = await Promise.all([
      this.pasturesService.occupancyStats(farmId),
      this.suppliesService.alerts(farmId),
      this.agendaService.alerts(farmId),
      this.healthRecordsService.pendingAlerts(farmId),
      this.weatherService.activeAlerts(farmId),
      this.soilAnalysisService.findAll(farmId),
    ]);

    const suggestions: string[] = [];

    if (
      occupancy.totalCapacity > 0 &&
      occupancy.occupancyRate >= HIGH_OCCUPANCY_THRESHOLD
    ) {
      suggestions.push(
        `Lotação de pastagens em ${(occupancy.occupancyRate * 100).toFixed(0)}% — considere rotação ou redução de lote.`,
      );
    }

    for (const s of supplyAlerts) {
      if (s.lowStock) {
        suggestions.push(
          `Estoque baixo de ${s.name} (${s.currentQuantity}/${s.minimumQuantity} ${s.unit}) — providencie reposição.`,
        );
      }
      if (s.expired) {
        suggestions.push(
          `${s.name} está vencido — descarte conforme orientação do fabricante.`,
        );
      } else if (s.expiringSoon) {
        suggestions.push(
          `${s.name} vence em breve — priorize o uso ou providencie substituição.`,
        );
      }
    }

    for (const e of agendaAlerts) {
      if (e.overdue) {
        suggestions.push(
          `Evento da agenda "${e.title}" (${e.type}) está atrasado.`,
        );
      }
    }

    for (const h of healthAlerts) {
      if (h.overdue) {
        suggestions.push(
          `Vacina "${h.vaccineName}" do animal ${h.animalEarTag} está atrasada.`,
        );
      }
    }

    for (const w of weatherAlerts) {
      suggestions.push(
        `Alerta climático ativo (${w.alertType}) — avalie manejo e proteção do rebanho.`,
      );
    }

    for (const analysis of soilAnalyses) {
      const rec = this.soilAnalysisService.recommendation(analysis);
      if (rec.limingNeeded) {
        suggestions.push(
          `Análise de solo${analysis.areaLabel ? ` (${analysis.areaLabel})` : ''} indica necessidade de calagem (~${rec.limestoneTonPerHa} t/ha).`,
        );
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('Nenhuma pendência crítica identificada no momento.');
    }

    return suggestions;
  }

  async overview(farmId: string) {
    const kpis = await this.kpis(farmId);
    const [
      forecastWeightGain,
      forecastSales,
      managementSuggestions,
      additionalData,
    ] = await Promise.all([
      this.forecastWeightGain(farmId),
      this.forecastSales(farmId),
      this.managementSuggestions(farmId),
      this.additionalData(farmId, kpis.arrobasProduzidas),
    ]);

    return {
      kpis,
      forecastWeightGain,
      forecastSales,
      managementSuggestions,
      additionalData,
    };
  }
}
