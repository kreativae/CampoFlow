import { Injectable } from '@nestjs/common';
import { AnimalsService } from '../animals/animals.service';
import { WeighingsService } from '../weighings/weighings.service';
import { PasturesService } from '../pastures/pastures.service';
import { FinanceService } from '../finance/finance.service';
import { HealthRecordsService } from '../health-records/health-records.service';

const MIN_WEIGHINGS_FOR_GAIN = 2;

@Injectable()
export class DashboardService {
  constructor(
    private readonly animalsService: AnimalsService,
    private readonly weighingsService: WeighingsService,
    private readonly pasturesService: PasturesService,
    private readonly financeService: FinanceService,
    private readonly healthRecordsService: HealthRecordsService,
  ) {}

  async getOverview(farmId: string) {
    const animals = await this.animalsService.findAll(farmId);

    const weights = animals
      .map((a) => a.currentWeightKg)
      .filter((w): w is number => w !== null);
    const averageWeightKg =
      weights.length > 0
        ? weights.reduce((sum, w) => sum + w, 0) / weights.length
        : 0;

    const gainSummaries = await Promise.all(
      animals.map((a) => this.weighingsService.gainSummary(farmId, a.id)),
    );
    const validGains = gainSummaries.filter(
      (g) => g.weighingsCount >= MIN_WEIGHINGS_FOR_GAIN,
    );
    const averageDailyGainKg =
      validGains.length > 0
        ? validGains.reduce((sum, g) => sum + g.averageDailyGainKg, 0) /
          validGains.length
        : 0;

    const [occupancy, cashFlow, pendingAlerts] = await Promise.all([
      this.pasturesService.occupancyStats(farmId),
      this.financeService.cashFlow(farmId, 'monthly'),
      this.healthRecordsService.pendingAlerts(farmId),
    ]);

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const currentMonth = cashFlow.find((b) => b.period === currentMonthKey) ?? {
      receita: 0,
      despesa: 0,
      saldo: 0,
    };

    return {
      totalAnimals: animals.length,
      averageWeightKg: Number(averageWeightKg.toFixed(2)),
      averageDailyGainKg: Number(averageDailyGainKg.toFixed(3)),
      stockingRate: occupancy,
      currentMonthFinance: currentMonth,
      pendingAlerts,
    };
  }
}
