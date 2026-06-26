import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportTable } from './report-table';

export type ReportType =
  | 'rebanho'
  | 'financeiro'
  | 'sanidade'
  | 'reproducao'
  | 'custos';

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(farmId: string, type: ReportType): Promise<ReportTable> {
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
