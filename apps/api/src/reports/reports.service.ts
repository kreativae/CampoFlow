import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportTable } from './report-table';

export type ReportType =
  | 'rebanho'
  | 'financeiro'
  | 'sanidade'
  | 'reproducao'
  | 'custos'
  | 'abate';

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(farmId: string, type: ReportType, options?: { dealId?: string }): Promise<ReportTable> {
    switch (type) {
      case 'rebanho':
        return this.buildHerdReport(farmId);
      case 'financeiro':
        return this.buildFinanceReport(farmId);
      case 'sanidade':
        return this.buildHealthReport(farmId);
      case 'reproducao':
        return this.buildReproductionReport(farmId);
      case 'custos':
        return this.buildCostsReport(farmId);
      case 'abate':
        if (!options?.dealId) throw new BadRequestException('dealId é obrigatório para relatório de abate');
        return this.buildSlaughterReport(farmId, options.dealId);
      default:
        throw new BadRequestException('Tipo de relatório inválido');
    }
  }

  private async buildHerdReport(farmId: string): Promise<ReportTable> {
    const animals = await this.prisma.animal.findMany({
      where: { farmId, active: true },
      include: { pasture: { select: { name: true } } },
      orderBy: { earTag: 'asc' },
    });

    return {
      title: 'Relatório de Rebanho',
      headers: ['Brinco', 'Categoria', 'Sexo', 'Raça', 'Peso (kg)', 'Pasto'],
      rows: animals.map((a) => [
        a.earTag,
        a.category,
        a.sex === 'FEMALE' ? 'Fêmea' : 'Macho',
        a.breed ?? '-',
        a.currentWeightKg ?? '-',
        a.pasture?.name ?? '-',
      ]),
    };
  }

  private async buildFinanceReport(farmId: string): Promise<ReportTable> {
    const transactions = await this.prisma.transaction.findMany({
      where: { farmId },
      orderBy: { dueDate: 'desc' },
    });

    return {
      title: 'Relatório Financeiro',
      headers: [
        'Tipo',
        'Categoria',
        'Descrição',
        'Valor (R$)',
        'Vencimento',
        'Pago em',
      ],
      rows: transactions.map((t) => [
        t.type,
        t.category,
        t.description ?? '-',
        t.amount,
        formatDate(t.dueDate),
        formatDate(t.paidAt),
      ]),
    };
  }

  private async buildHealthReport(farmId: string): Promise<ReportTable> {
    const [vaccinations, treatments] = await Promise.all([
      this.prisma.vaccinationRecord.findMany({
        where: { animal: { farmId } },
        include: { animal: { select: { earTag: true } } },
        orderBy: { scheduledDate: 'desc' },
      }),
      this.prisma.treatmentRecord.findMany({
        where: { animal: { farmId } },
        include: { animal: { select: { earTag: true } } },
        orderBy: { treatmentDate: 'desc' },
      }),
    ]);

    const rows: (string | number)[][] = [
      ...vaccinations.map((v) => [
        'Vacinação',
        v.animal.earTag,
        v.vaccineName,
        formatDate(v.scheduledDate),
        v.administeredAt ? 'Aplicada' : 'Pendente',
      ]),
      ...treatments.map((t) => [
        'Tratamento',
        t.animal.earTag,
        t.medication,
        formatDate(t.treatmentDate),
        t.diagnosis ?? '-',
      ]),
    ];

    return {
      title: 'Relatório de Sanidade',
      headers: ['Tipo', 'Brinco', 'Item', 'Data', 'Status/Diagnóstico'],
      rows,
    };
  }

  private async buildReproductionReport(farmId: string): Promise<ReportTable> {
    const events = await this.prisma.reproductiveEvent.findMany({
      where: { animal: { farmId } },
      include: { animal: { select: { earTag: true } } },
      orderBy: { eventDate: 'desc' },
    });

    return {
      title: 'Relatório de Reprodução',
      headers: ['Brinco', 'Tipo de Evento', 'Data', 'Resultado'],
      rows: events.map((e) => [
        e.animal.earTag,
        e.type,
        formatDate(e.eventDate),
        e.result ?? '-',
      ]),
    };
  }

  private async buildSlaughterReport(farmId: string, dealId: string): Promise<ReportTable> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { items: { include: { animal: { select: { earTag: true, name: true } } } } },
    });
    if (!deal || deal.farmId !== farmId || deal.type !== 'ABATE') {
      throw new BadRequestException('Negócio de abate não encontrado');
    }

    const yieldPct = (deal.carcassYieldPercent ?? 52) / 100;
    const pricePerKg = deal.liveWeightPricePerKg ?? 0;
    let totalLiveWeight = 0;
    let totalCarcassWeight = 0;
    let totalArrobas = 0;
    let totalEstValue = 0;

    const rows: (string | number)[][] = deal.items.map((item) => {
      const liveKg = item.weightKg ?? 0;
      const carcassKg = liveKg * yieldPct;
      const arrobas = carcassKg / 15;
      const estValue = liveKg * pricePerKg;
      totalLiveWeight += liveKg;
      totalCarcassWeight += carcassKg;
      totalArrobas += arrobas;
      totalEstValue += estValue;
      return [
        item.earTag,
        liveKg || '-',
        `${(yieldPct * 100).toFixed(1)}%`,
        Number(carcassKg.toFixed(1)) || '-',
        Number(arrobas.toFixed(2)) || '-',
        Number(estValue.toFixed(2)) || '-',
      ];
    });

    const funruralValue = totalEstValue * ((deal.funruralPercent ?? 0) / 100);
    const senarValue = totalEstValue * ((deal.senarPercent ?? 0) / 100);
    const commissionValue = totalEstValue * (deal.commissionPercent / 100);
    const netTotal = totalEstValue - funruralValue - senarValue - commissionValue - deal.freightCost;

    rows.push(
      ['TOTAL', totalLiveWeight.toFixed(1), '', totalCarcassWeight.toFixed(1), totalArrobas.toFixed(2), totalEstValue.toFixed(2)],
      ['', '', '', '', 'Funrural', funruralValue.toFixed(2)],
      ['', '', '', '', 'SENAR', senarValue.toFixed(2)],
      ['', '', '', '', 'Comissão', commissionValue.toFixed(2)],
      ['', '', '', '', 'Frete', deal.freightCost.toFixed(2)],
      ['', '', '', '', 'VALOR LÍQUIDO', netTotal.toFixed(2)],
    );

    return {
      title: `Relatório de Abate — ${deal.counterparty ?? 'Sem frigorífico'} — ${deal.dealDate.toISOString().slice(0, 10)}`,
      headers: ['Brinco', 'Peso Vivo (kg)', 'Rendimento', 'Carcaça (kg)', 'Arrobas', 'Valor Est. (R$)'],
      rows,
    };
  }

  private async buildCostsReport(farmId: string): Promise<ReportTable> {
    const [expenses, maintenances, fuelRecords] = await Promise.all([
      this.prisma.transaction.findMany({ where: { farmId, type: 'DESPESA' } }),
      this.prisma.machineMaintenance.findMany({
        where: { machine: { farmId } },
        include: { machine: { select: { name: true } } },
      }),
      this.prisma.machineFuelRecord.findMany({
        where: { machine: { farmId } },
        include: { machine: { select: { name: true } } },
      }),
    ]);

    const rows: (string | number)[][] = [
      ...expenses.map((e) => [
        'Despesa',
        e.category,
        e.description ?? '-',
        e.amount,
        formatDate(e.dueDate),
      ]),
      ...maintenances.map((m) => [
        'Manutenção',
        m.machine.name,
        m.description,
        m.cost ?? 0,
        formatDate(m.performedAt),
      ]),
      ...fuelRecords.map((f) => [
        'Combustível',
        f.machine.name,
        `${f.liters} L`,
        f.cost ?? 0,
        formatDate(f.recordedAt),
      ]),
    ];

    return {
      title: 'Relatório de Custos',
      headers: [
        'Origem',
        'Categoria/Máquina',
        'Descrição',
        'Valor (R$)',
        'Data',
      ],
      rows,
    };
  }
}
