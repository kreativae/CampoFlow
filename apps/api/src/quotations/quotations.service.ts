import { Injectable } from '@nestjs/common';
import { Commodity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateQuotationDto) {
    return this.prisma.quotation.create({
      data: {
        commodity: dto.commodity,
        price: dto.price,
        unit: dto.unit,
        source: dto.source,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
        createdById: userId,
      },
    });
  }

  history(commodity?: Commodity, limit = 50) {
    return this.prisma.quotation.findMany({
      where: commodity ? { commodity } : undefined,
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  // Latest recorded price per commodity, with percentage change vs. the previous record.
  async latest() {
    const all = await this.prisma.quotation.findMany({
      orderBy: { recordedAt: 'desc' },
    });

    const byCommodity = new Map<Commodity, typeof all>();
    for (const quotation of all) {
      const list = byCommodity.get(quotation.commodity) ?? [];
      list.push(quotation);
      byCommodity.set(quotation.commodity, list);
    }

    return Array.from(byCommodity.entries()).map(([commodity, records]) => {
      const [current, previous] = records;
      const changePercent = previous
        ? ((current.price - previous.price) / previous.price) * 100
        : 0;

      return {
        commodity,
        price: current.price,
        unit: current.unit,
        source: current.source,
        recordedAt: current.recordedAt,
        changePercent: Number(changePercent.toFixed(2)),
      };
    });
  }
}
