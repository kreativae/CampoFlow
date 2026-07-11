import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

const DEAL_INCLUDE = {
  items: {
    include: {
      animal: {
        select: { id: true, earTag: true, name: true, breed: true, category: true },
      },
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(farmId: string, createdById: string, dto: CreateDealDto) {
    return this.prisma.deal.create({
      data: {
        farmId,
        createdById,
        type: dto.type,
        counterparty: dto.counterparty,
        pricePerUnit: dto.pricePerUnit ?? 0,
        priceUnit: dto.priceUnit ?? 'ANIMAL',
        freightCost: dto.freightCost ?? 0,
        commissionPercent: dto.commissionPercent ?? 0,
        quantity: dto.quantity,
        installmentCount: dto.installmentCount,
        installmentValue: dto.installmentValue,
        totalValue: dto.totalValue,
        carcassYieldPercent: dto.carcassYieldPercent,
        liveWeightPricePerKg: dto.liveWeightPricePerKg,
        funruralPercent: dto.funruralPercent,
        senarPercent: dto.senarPercent,
        slaughterFrequency: dto.slaughterFrequency,
        notes: dto.notes,
        dealDate: new Date(dto.dealDate),
        items: {
          create: (dto.items ?? []).map((item) => ({
            animalId: item.animalId,
            earTag: item.earTag,
            weightKg: item.weightKg,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: DEAL_INCLUDE,
    });
  }

  findAll(farmId: string, query?: { type?: string; status?: string }) {
    return this.prisma.deal.findMany({
      where: {
        farmId,
        ...(query?.type ? { type: query.type as any } : {}),
        ...(query?.status ? { status: query.status as any } : {}),
      },
      include: DEAL_INCLUDE,
      orderBy: { dealDate: 'desc' },
    });
  }

  async findOne(farmId: string, id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: DEAL_INCLUDE,
    });
    if (!deal || deal.farmId !== farmId) {
      throw new NotFoundException('Negócio não encontrado');
    }
    return deal;
  }

  async update(farmId: string, id: string, dto: UpdateDealDto) {
    await this.findOne(farmId, id);

    const { items, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.dealItem.deleteMany({ where: { dealId: id } });
        await tx.dealItem.createMany({
          data: items.map((item) => ({
            dealId: id,
            animalId: item.animalId,
            earTag: item.earTag,
            weightKg: item.weightKg,
            unitPrice: item.unitPrice,
          })),
        });
      }

      const updated = await tx.deal.update({
        where: { id },
        data: {
          ...data,
          ...(data.dealDate ? { dealDate: new Date(data.dealDate) } : {}),
        },
        include: DEAL_INCLUDE,
      });

      // Dar baixa nos animais ao finalizar venda ou abate
      if (
        data.status === 'FINALIZADO' &&
        (updated.type === 'VENDA' || updated.type === 'ABATE')
      ) {
        const animalIds = updated.items
          .map((i) => i.animalId)
          .filter((id): id is string => id != null);
        if (animalIds.length > 0) {
          await tx.animal.updateMany({
            where: { id: { in: animalIds } },
            data: { active: false },
          });
        }
      }

      return updated;
    });
  }

  async remove(farmId: string, id: string) {
    await this.findOne(farmId, id);
    return this.prisma.deal.delete({ where: { id } });
  }

  summary(deal: {
    type?: string;
    pricePerUnit: number;
    priceUnit: string;
    freightCost: number;
    commissionPercent: number;
    quantity?: number | null;
    totalValue?: number | null;
    carcassYieldPercent?: number | null;
    liveWeightPricePerKg?: number | null;
    funruralPercent?: number | null;
    senarPercent?: number | null;
    items: { weightKg?: number | null; unitPrice?: number | null }[];
  }) {
    const totalAnimals = deal.quantity ?? deal.items.length;
    const totalWeight = deal.items.reduce(
      (sum, item) => sum + (item.weightKg ?? 0),
      0,
    );

    // Abate: cálculo baseado em rendimento de carcaça
    if (deal.type === 'ABATE') {
      const yieldPct = (deal.carcassYieldPercent ?? 52) / 100;
      const pricePerKg = deal.liveWeightPricePerKg ?? 0;
      const carcassWeight = totalWeight * yieldPct;
      const carcassArrobas = carcassWeight / 15;
      const grossValue = totalWeight * pricePerKg;
      const funruralValue = grossValue * ((deal.funruralPercent ?? 0) / 100);
      const senarValue = grossValue * ((deal.senarPercent ?? 0) / 100);
      const commissionValue = grossValue * (deal.commissionPercent / 100);
      const netTotal = grossValue - funruralValue - senarValue - commissionValue - deal.freightCost;
      return {
        totalAnimals,
        totalWeight,
        totalArrobas: carcassArrobas,
        carcassWeight,
        subtotal: grossValue,
        freightCost: deal.freightCost,
        freightPerAnimal: totalAnimals > 0 ? deal.freightCost / totalAnimals : 0,
        freightPerArroba: carcassArrobas > 0 ? deal.freightCost / carcassArrobas : 0,
        commissionPercent: deal.commissionPercent,
        commissionValue,
        funruralValue,
        senarValue,
        grandTotal: grossValue,
        netTotal,
        pricePerAnimal: totalAnimals > 0 ? netTotal / totalAnimals : 0,
        pricePerArroba: carcassArrobas > 0 ? netTotal / carcassArrobas : 0,
      };
    }

    const totalArrobas = totalWeight / 15;

    let subtotal: number;
    if (deal.priceUnit === 'ARROBA') {
      subtotal = deal.pricePerUnit * totalArrobas;
    } else {
      subtotal = deal.pricePerUnit * totalAnimals;
    }

    const itemsWithPrice = deal.items.filter((i) => i.unitPrice != null);
    if (
      itemsWithPrice.length === deal.items.length &&
      deal.items.length > 0
    ) {
      subtotal = itemsWithPrice.reduce((sum, i) => sum + (i.unitPrice ?? 0), 0);
    }

    if (deal.totalValue != null && deal.totalValue > 0) {
      subtotal = deal.totalValue;
    }

    const commissionValue = subtotal * (deal.commissionPercent / 100);
    const grandTotal = subtotal + deal.freightCost + commissionValue;
    const pricePerAnimal = totalAnimals > 0 ? grandTotal / totalAnimals : 0;
    const pricePerArroba = totalArrobas > 0 ? grandTotal / totalArrobas : 0;
    const freightPerAnimal =
      totalAnimals > 0 ? deal.freightCost / totalAnimals : 0;
    const freightPerArroba =
      totalArrobas > 0 ? deal.freightCost / totalArrobas : 0;

    return {
      totalAnimals,
      totalWeight,
      totalArrobas,
      subtotal,
      freightCost: deal.freightCost,
      freightPerAnimal,
      freightPerArroba,
      commissionPercent: deal.commissionPercent,
      commissionValue,
      grandTotal,
      pricePerAnimal,
      pricePerArroba,
    };
  }
}
