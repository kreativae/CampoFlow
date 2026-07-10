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
        pricePerUnit: dto.pricePerUnit,
        priceUnit: dto.priceUnit ?? 'ANIMAL',
        freightCost: dto.freightCost ?? 0,
        commissionPercent: dto.commissionPercent ?? 0,
        notes: dto.notes,
        dealDate: new Date(dto.dealDate),
        items: {
          create: dto.items.map((item) => ({
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

      return tx.deal.update({
        where: { id },
        data: {
          ...data,
          ...(data.dealDate ? { dealDate: new Date(data.dealDate) } : {}),
        },
        include: DEAL_INCLUDE,
      });
    });
  }

  async remove(farmId: string, id: string) {
    await this.findOne(farmId, id);
    return this.prisma.deal.delete({ where: { id } });
  }

  summary(deal: {
    pricePerUnit: number;
    priceUnit: string;
    freightCost: number;
    commissionPercent: number;
    items: { weightKg?: number | null; unitPrice?: number | null }[];
  }) {
    const totalAnimals = deal.items.length;
    const totalWeight = deal.items.reduce(
      (sum, item) => sum + (item.weightKg ?? 0),
      0,
    );
    const totalArrobas = totalWeight / 15;

    // Calculate subtotal based on price unit
    let subtotal: number;
    if (deal.priceUnit === 'ARROBA') {
      subtotal = deal.pricePerUnit * totalArrobas;
    } else {
      // ANIMAL
      subtotal = deal.pricePerUnit * totalAnimals;
    }

    // Override with per-item prices if present
    const itemsWithPrice = deal.items.filter((i) => i.unitPrice != null);
    if (itemsWithPrice.length === totalAnimals && totalAnimals > 0) {
      subtotal = itemsWithPrice.reduce((sum, i) => sum + (i.unitPrice ?? 0), 0);
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
