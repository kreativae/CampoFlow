import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupplyMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

const EXPIRATION_WINDOW_DAYS = 30;

@Injectable()
export class SuppliesService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreateSupplyDto) {
    return this.prisma.supply.create({
      data: {
        farmId,
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        currentQuantity: dto.initialQuantity ?? 0,
        minimumQuantity: dto.minimumQuantity,
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : undefined,
        notes: dto.notes,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.supply.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(farmId: string, supplyId: string) {
    const supply = await this.prisma.supply.findUnique({
      where: { id: supplyId },
      include: { movements: { orderBy: { occurredAt: 'desc' } } },
    });
    if (!supply || supply.farmId !== farmId) {
      throw new NotFoundException('Insumo não encontrado');
    }
    return supply;
  }

  async update(farmId: string, supplyId: string, dto: UpdateSupplyDto) {
    await this.findOne(farmId, supplyId);
    return this.prisma.supply.update({
      where: { id: supplyId },
      data: {
        ...dto,
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : undefined,
      },
    });
  }

  async remove(farmId: string, supplyId: string) {
    await this.findOne(farmId, supplyId);
    await this.prisma.supply.delete({ where: { id: supplyId } });
    return { success: true };
  }

  // Registers a stock entry/exit, keeping Supply.currentQuantity in sync atomically.
  async addMovement(farmId: string, supplyId: string, dto: CreateMovementDto) {
    const supply = await this.findOne(farmId, supplyId);

    if (
      dto.type === SupplyMovementType.SAIDA &&
      dto.quantity > supply.currentQuantity
    ) {
      throw new BadRequestException(
        `Estoque insuficiente: disponível ${supply.currentQuantity} ${supply.unit}`,
      );
    }

    const delta =
      dto.type === SupplyMovementType.ENTRADA ? dto.quantity : -dto.quantity;

    const [, movement] = await this.prisma.$transaction([
      this.prisma.supply.update({
        where: { id: supplyId },
        data: { currentQuantity: { increment: delta } },
      }),
      this.prisma.supplyMovement.create({
        data: {
          supplyId,
          type: dto.type,
          quantity: dto.quantity,
          notes: dto.notes,
        },
      }),
    ]);

    return movement;
  }

  // Low-stock and near-expiration/expired supplies for the farm.
  async alerts(farmId: string) {
    const supplies = await this.prisma.supply.findMany({ where: { farmId } });
    const expirationWindow = new Date();
    expirationWindow.setDate(
      expirationWindow.getDate() + EXPIRATION_WINDOW_DAYS,
    );

    return supplies
      .filter(
        (s) =>
          s.currentQuantity <= s.minimumQuantity ||
          (s.expirationDate && s.expirationDate <= expirationWindow),
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        unit: s.unit,
        currentQuantity: s.currentQuantity,
        minimumQuantity: s.minimumQuantity,
        lowStock: s.currentQuantity <= s.minimumQuantity,
        expirationDate: s.expirationDate,
        expiringSoon: Boolean(
          s.expirationDate && s.expirationDate <= expirationWindow,
        ),
        expired: Boolean(s.expirationDate && s.expirationDate < new Date()),
      }));
  }
}
