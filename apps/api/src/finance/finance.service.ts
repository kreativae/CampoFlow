import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

type Granularity = 'daily' | 'weekly' | 'monthly';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        ...dto,
        farmId,
        dueDate: new Date(dto.dueDate),
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.transaction.findMany({
      where: { farmId },
      orderBy: { dueDate: 'desc' },
    });
  }

  async findOne(farmId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction || transaction.farmId !== farmId) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    return transaction;
  }

  async update(
    farmId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    await this.findOne(farmId, transactionId);
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
    });
  }

  async markPaid(farmId: string, transactionId: string) {
    await this.findOne(farmId, transactionId);
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { paidAt: new Date() },
    });
  }

  async remove(farmId: string, transactionId: string) {
    await this.findOne(farmId, transactionId);
    await this.prisma.transaction.delete({ where: { id: transactionId } });
    return { success: true };
  }

  // Aggregates revenue/expense/balance per period bucket (daily/weekly/monthly),
  // using the paid date when available, falling back to the due date otherwise.
  async cashFlow(farmId: string, granularity: Granularity = 'monthly') {
    const transactions = await this.prisma.transaction.findMany({
      where: { farmId },
    });

    const buckets = new Map<string, { receita: number; despesa: number }>();
    for (const transaction of transactions) {
      const key = this.bucketKey(
        transaction.paidAt ?? transaction.dueDate,
        granularity,
      );
      const bucket = buckets.get(key) ?? { receita: 0, despesa: 0 };
      if (transaction.type === TransactionType.RECEITA) {
        bucket.receita += transaction.amount;
      } else {
        bucket.despesa += transaction.amount;
      }
      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { receita, despesa }]) => ({
        period,
        receita,
        despesa,
        saldo: receita - despesa,
      }));
  }

  private bucketKey(date: Date, granularity: Granularity): string {
    if (granularity === 'daily') {
      return date.toISOString().slice(0, 10);
    }
    if (granularity === 'monthly') {
      return date.toISOString().slice(0, 7);
    }
    return this.weekKey(date);
  }

  private weekKey(date: Date): string {
    const utcDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNumber = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - dayNumber + 1);
    return utcDate.toISOString().slice(0, 10);
  }
}
