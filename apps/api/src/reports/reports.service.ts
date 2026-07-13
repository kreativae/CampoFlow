import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportTable } from './report-table';

export type ReportType =
  | 'rebanho'
  | 'financeiro'
  | 'sanidade'
  | 'reproducao'
  | 'custos'
  | 'abate'
  | 'negocio';

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    farmId: string,
    type: ReportType,
    options?: { dealId?: string },
  ): Promise<ReportTable> {
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
        if (!options?.dealId)
          throw new BadRequestException(
            'dealId é obrigatório para relatório de abate',
          );
        return this.buildSlaughterReport(farmId, options.dealId);
      case 'negocio':
        if (!options?.dealId)
          throw new BadRequestException(
            'dealId é obrigatório para relatório de negócio',
          );
        return this.buildDealReport(farmId, options.dealId);
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

  private async buildSlaughterReport(
    farmId: string,
    dealId: string,
  ): Promise<ReportTable> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        items: {
          include: { animal: { select: { earTag: true, name: true } } },
        },
      },
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
    const netTotal =
      totalEstValue -
      funruralValue -
      senarValue -
      commissionValue -
      deal.freightCost;

    rows.push(
      [
        'TOTAL',
        totalLiveWeight.toFixed(1),
        '',
        totalCarcassWeight.toFixed(1),
        totalArrobas.toFixed(2),
        totalEstValue.toFixed(2),
      ],
      ['', '', '', '', 'Funrural', funruralValue.toFixed(2)],
      ['', '', '', '', 'SENAR', senarValue.toFixed(2)],
      ['', '', '', '', 'Comissão', commissionValue.toFixed(2)],
      ['', '', '', '', 'Frete', deal.freightCost.toFixed(2)],
      ['', '', '', '', 'VALOR LÍQUIDO', netTotal.toFixed(2)],
    );

    return {
      title: `Relatório de Abate — ${deal.counterparty ?? 'Sem frigorífico'} — ${deal.dealDate.toISOString().slice(0, 10)}`,
      headers: [
        'Brinco',
        'Peso Vivo (kg)',
        'Rendimento',
        'Carcaça (kg)',
        'Arrobas',
        'Valor Est. (R$)',
      ],
      rows,
    };
  }

  private async buildDealReport(
    farmId: string,
    dealId: string,
  ): Promise<ReportTable> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        items: {
          include: { animal: { select: { earTag: true, name: true } } },
        },
      },
    });
    if (!deal || deal.farmId !== farmId) {
      throw new BadRequestException('Negócio não encontrado');
    }

    if (deal.type === 'ABATE') {
      return this.buildSlaughterReport(farmId, dealId);
    }

    if (deal.type === 'VENDA_GRAO') {
      return this.buildGrainDealReport(deal);
    }

    const typeLabel = deal.type === 'VENDA' ? 'Venda' : 'Compra';
    const isVenda = deal.type === 'VENDA';
    const arrobaKg = 15;

    let totalWeight = 0;
    let totalArrobas = 0;

    const rows: (string | number)[][] = deal.items.map((item) => {
      const w = item.weightKg ?? 0;
      const arr = w / arrobaKg;
      totalWeight += w;
      totalArrobas += arr;
      return [
        item.earTag,
        w || '-',
        Number(arr.toFixed(2)) || '-',
        item.unitPrice != null ? item.unitPrice.toFixed(2) : '-',
      ];
    });

    const qty = deal.quantity ?? deal.items.length;
    let subtotal: number;
    if (deal.totalValue) {
      subtotal = deal.totalValue;
    } else if (deal.priceUnit === 'ARROBA') {
      subtotal = totalArrobas * deal.pricePerUnit;
    } else {
      subtotal = qty * deal.pricePerUnit;
    }
    const commissionValue = subtotal * (deal.commissionPercent / 100);
    const grandTotal = subtotal + deal.freightCost + commissionValue;

    rows.push(
      ['TOTAL', totalWeight.toFixed(1), totalArrobas.toFixed(2), ''],
      ['', '', 'Subtotal', subtotal.toFixed(2)],
      ['', '', 'Frete', deal.freightCost.toFixed(2)],
      [
        '',
        '',
        `Comissão (${deal.commissionPercent}%)`,
        commissionValue.toFixed(2),
      ],
      ['', '', 'TOTAL GERAL', grandTotal.toFixed(2)],
    );

    if (!isVenda && deal.installmentCount && deal.installmentCount > 0) {
      const parcela =
        deal.installmentValue ?? grandTotal / deal.installmentCount;
      rows.push([
        '',
        '',
        `Parcelamento (${deal.installmentCount}x)`,
        parcela.toFixed(2),
      ]);
    }

    return {
      title: `${typeLabel} — ${deal.counterparty ?? 'Sem contraparte'} — ${formatDate(deal.dealDate)}`,
      headers: ['Brinco', 'Peso (kg)', 'Arrobas', 'Valor un. (R$)'],
      rows,
    };
  }

  private buildGrainDealReport(deal: {
    counterparty: string | null;
    dealDate: Date;
    grainCrop: string | null;
    grainQuantity: number | null;
    grainUnit: string | null;
    grainGrossWeightKg: number | null;
    grainNetWeightKg: number | null;
    grainMoisturePercent: number | null;
    grainMoistureBasePercent: number | null;
    grainImpurityPercent: number | null;
    grainSaleModality: string | null;
    grainWarehouse: string | null;
    grainTicketRef: string | null;
    pricePerUnit: number;
    freightCost: number;
    commissionPercent: number;
    funruralPercent: number | null;
    senarPercent: number | null;
    totalValue: number | null;
  }): ReportTable {
    const unitLabel: Record<string, string> = {
      SACA60: 'Saca 60kg',
      KG: 'kg',
      TONELADA: 'Tonelada',
    };
    const modalityLabel: Record<string, string> = {
      BALCAO: 'Balcão',
      CONTRATO_FUTURO: 'Contrato futuro',
      COOPERATIVA: 'Cooperativa',
      BARTER: 'Barter',
    };

    const qty = deal.grainQuantity ?? 0;
    const grossValue = deal.totalValue ?? qty * deal.pricePerUnit;
    const funruralValue = grossValue * ((deal.funruralPercent ?? 0) / 100);
    const senarValue = grossValue * ((deal.senarPercent ?? 0) / 100);
    const commissionValue = grossValue * (deal.commissionPercent / 100);
    const netTotal =
      grossValue -
      funruralValue -
      senarValue -
      commissionValue -
      deal.freightCost;
    const sacas = deal.grainNetWeightKg ? deal.grainNetWeightKg / 60 : qty;
    const netPerSaca = sacas > 0 ? netTotal / sacas : 0;

    const rows: (string | number)[][] = [
      ['Cultura', deal.grainCrop ?? '-'],
      [
        'Quantidade',
        `${qty} ${unitLabel[deal.grainUnit ?? ''] ?? deal.grainUnit ?? '-'}`,
      ],
      ['Preço por unidade', deal.pricePerUnit.toFixed(2)],
      ['Peso bruto (kg)', deal.grainGrossWeightKg?.toFixed(1) ?? '-'],
      ['Peso líquido (kg)', deal.grainNetWeightKg?.toFixed(1) ?? '-'],
      [
        'Umidade (%)',
        deal.grainMoisturePercent != null
          ? `${deal.grainMoisturePercent}% (base ${deal.grainMoistureBasePercent ?? 14}%)`
          : '-',
      ],
      [
        'Impureza (%)',
        deal.grainImpurityPercent != null
          ? `${deal.grainImpurityPercent}%`
          : '-',
      ],
      [
        'Modalidade',
        modalityLabel[deal.grainSaleModality ?? ''] ??
          deal.grainSaleModality ??
          '-',
      ],
      ['Armazém', deal.grainWarehouse ?? '-'],
      ['Placa/Ticket', deal.grainTicketRef ?? '-'],
      ['', ''],
      ['Valor bruto', grossValue.toFixed(2)],
      [`Funrural (${deal.funruralPercent ?? 0}%)`, funruralValue.toFixed(2)],
      [`SENAR (${deal.senarPercent ?? 0}%)`, senarValue.toFixed(2)],
      [`Comissão (${deal.commissionPercent}%)`, commissionValue.toFixed(2)],
      ['Frete', deal.freightCost.toFixed(2)],
      ['VALOR LÍQUIDO', netTotal.toFixed(2)],
      ['R$/saca líquido', netPerSaca.toFixed(2)],
    ];

    return {
      title: `Venda de Grãos — ${deal.grainCrop ?? ''} — ${deal.counterparty ?? 'Sem contraparte'} — ${formatDate(deal.dealDate)}`,
      headers: ['Item', 'Valor'],
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
