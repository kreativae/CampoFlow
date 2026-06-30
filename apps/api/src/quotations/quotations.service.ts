import { Injectable } from '@nestjs/common';
import { BrazilianState, Commodity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateQuotationDto) {
    return this.prisma.quotation.create({
      data: {
        commodity: dto.commodity,
        state: dto.state,
        price: dto.price,
        unit: dto.unit,
        source: dto.source,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
        createdById: userId,
      },
    });
  }

  history(commodity?: Commodity, state?: BrazilianState, limit = 50) {
    return this.prisma.quotation.findMany({
      where: {
        ...(commodity ? { commodity } : {}),
        ...(state ? { state } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  // Latest recorded price per commodity+state combination (state null = national/
  // aggregate quote), with percentage change vs. the previous record in that same
  // combination.
  async latest() {
    const all = await this.prisma.quotation.findMany({
      orderBy: { recordedAt: 'desc' },
    });

    const byGroup = new Map<string, typeof all>();
    for (const quotation of all) {
      const key = `${quotation.commodity}::${quotation.state ?? ''}`;
      const list = byGroup.get(key) ?? [];
      list.push(quotation);
      byGroup.set(key, list);
    }

    return Array.from(byGroup.values()).map((records) => {
      const [current, previous] = records;
      const changePercent = previous
        ? ((current.price - previous.price) / previous.price) * 100
        : 0;

      return {
        commodity: current.commodity,
        state: current.state,
        price: current.price,
        unit: current.unit,
        source: current.source,
        recordedAt: current.recordedAt,
        changePercent: Number(changePercent.toFixed(2)),
      };
    });
  }
}
