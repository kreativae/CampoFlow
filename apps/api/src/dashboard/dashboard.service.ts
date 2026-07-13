import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { AnimalsService } from '../animals/animals.service';
import { WeighingsService } from '../weighings/weighings.service';
import { PasturesService } from '../pastures/pastures.service';
import { FinanceService } from '../finance/finance.service';
import { HealthRecordsService } from '../health-records/health-records.service';
import { FarmsService } from '../farms/farms.service';
import { ReproductionService } from '../reproduction/reproduction.service';
import { SuppliesService } from '../supplies/supplies.service';
import { MachinesService } from '../machines/machines.service';
import { TasksService } from '../teams/tasks.service';
import { EmployeesService } from '../employees/employees.service';
import { AgendaService } from '../agenda/agenda.service';
import { MapFeaturesService } from '../map-features/map-features.service';
import { SoilAnalysisService } from '../soil-analysis/soil-analysis.service';
import { CropsService } from '../crops/crops.service';
import { DocumentsService } from '../documents/documents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuotationsService } from '../quotations/quotations.service';

const MIN_WEIGHINGS_FOR_GAIN = 2;
const RECENT_QUOTATIONS_LIMIT = 3;

@Injectable()
export class DashboardService {
  constructor(
    private readonly animalsService: AnimalsService,
    private readonly weighingsService: WeighingsService,
    private readonly pasturesService: PasturesService,
    private readonly financeService: FinanceService,
    private readonly healthRecordsService: HealthRecordsService,
    private readonly farmsService: FarmsService,
    private readonly reproductionService: ReproductionService,
    private readonly suppliesService: SuppliesService,
    private readonly machinesService: MachinesService,
    private readonly tasksService: TasksService,
    private readonly employeesService: EmployeesService,
    private readonly agendaService: AgendaService,
    private readonly mapFeaturesService: MapFeaturesService,
    private readonly soilAnalysisService: SoilAnalysisService,
    private readonly cropsService: CropsService,
    private readonly documentsService: DocumentsService,
    private readonly notificationsService: NotificationsService,
    private readonly quotationsService: QuotationsService,
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

  // One summary block per module, each reusing that module's own service — no
  // business logic is recomputed here, only aggregated for display. Backs the
  // "visão geral" dashboard page that links out to every other screen.
  async getFullOverview(farmId: string, userId: string) {
    const [
      herd,
      members,
      reproductionStats,
      supplyAlerts,
      supplies,
      machines,
      machinesCosts,
      tasks,
      employeesSummary,
      agendaAlerts,
      mapFeatures,
      soilAnalyses,
      cropCycles,
      documents,
      unreadNotifications,
      recentQuotations,
    ] = await Promise.all([
      this.getOverview(farmId),
      this.farmsService.listMembers(farmId),
      this.reproductionService.stats(farmId),
      this.suppliesService.alerts(farmId),
      this.suppliesService.findAll(farmId),
      this.machinesService.findAll(farmId),
      this.machinesService.costsSummary(farmId),
      this.tasksService.findAll(farmId),
      this.employeesService.summary(farmId),
      this.agendaService.alerts(farmId),
      this.mapFeaturesService.findAll(farmId),
      this.soilAnalysisService.findAll(farmId),
      this.cropsService.findAll(farmId),
      this.documentsService.findAll(farmId),
      this.notificationsService.unreadCount(farmId, userId),
      this.quotationsService.latest(),
    ]);

    const openTasks = tasks.filter(
      (t) =>
        t.status !== TaskStatus.CONCLUIDA && t.status !== TaskStatus.CANCELADA,
    );

    return {
      herd,
      members: { total: members.length },
      reproduction: reproductionStats,
      supplies: {
        total: supplies.length,
        alertsCount: supplyAlerts.length,
        alerts: supplyAlerts.slice(0, 5),
      },
      machines: {
        total: machines.length,
        costsSummary: machinesCosts,
      },
      tasks: {
        total: tasks.length,
        openCount: openTasks.length,
      },
      employees: employeesSummary,
      agenda: {
        upcomingCount: agendaAlerts.length,
        upcoming: agendaAlerts.slice(0, 5),
      },
      map: {
        featuresCount: mapFeatures.length,
        soilAnalysesCount: soilAnalyses.length,
      },
      crops: {
        total: cropCycles.length,
        activeCount: cropCycles.filter((c) => c.status !== 'COLHIDA').length,
      },
      documents: { total: documents.length },
      notifications: { unreadCount: unreadNotifications },
      quotations: recentQuotations.slice(0, RECENT_QUOTATIONS_LIMIT),
    };
  }
}
