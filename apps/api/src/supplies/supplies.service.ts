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
import { UpdateMovementDto } from './dto/update-movement.dto';

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
        customCategory: dto.customCategory,
        unit: dto.unit,
        currentQuantity: dto.initialQuantity ?? 0,
        minimumQuantity: dto.minimumQuantity ?? 0,
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

  private movementDelta(type: SupplyMovementType, quantity: number) {
    return type === SupplyMovementType.ENTRADA ? quantity : -quantity;
  }

  private async assertMovementBelongsToSupply(
    supplyId: string,
    movementId: string,
  ) {
    const movement = await this.prisma.supplyMovement.findUnique({
      where: { id: movementId },
    });
    if (!movement || movement.supplyId !== supplyId) {
      throw new NotFoundException('Movimentação não encontrada');
    }
    return movement;
  }

  // Edits a movement and adjusts Supply.currentQuantity by the difference between the
  // old and new effect on stock — not a full recompute, since the supply's starting
  // currentQuantity (initialQuantity at creation) has no corresponding movement row.
  async updateMovement(
    farmId: string,
    supplyId: string,
    movementId: string,
    dto: UpdateMovementDto,
  ) {
    const supply = await this.findOne(farmId, supplyId);
    const existing = await this.assertMovementBelongsToSupply(
      supplyId,
      movementId,
    );

    const newType = dto.type ?? existing.type;
    const newQuantity = dto.quantity ?? existing.quantity;
    const oldDelta = this.movementDelta(existing.type, existing.quantity);
    const newDelta = this.movementDelta(newType, newQuantity);
    const adjustment = newDelta - oldDelta;
    const prospectiveQuantity = supply.currentQuantity + adjustment;

    if (prospectiveQuantity < 0) {
      throw new BadRequestException(
        `Estoque insuficiente para essa alteração: resultaria em ${prospectiveQuantity} ${supply.unit}`,
      );
    }

    const [, movement] = await this.prisma.$transaction([
      this.prisma.supply.update({
        where: { id: supplyId },
        data: { currentQuantity: { increment: adjustment } },
      }),
      this.prisma.supplyMovement.update({
        where: { id: movementId },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(dto.occurredAt !== undefined
            ? { occurredAt: new Date(dto.occurredAt) }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      }),
    ]);

    return movement;
  }

  async removeMovement(farmId: string, supplyId: string, movementId: string) {
    const supply = await this.findOne(farmId, supplyId);
    const existing = await this.assertMovementBelongsToSupply(
      supplyId,
      movementId,
    );

    const adjustment = -this.movementDelta(existing.type, existing.quantity);
    const prospectiveQuantity = supply.currentQuantity + adjustment;

    if (prospectiveQuantity < 0) {
      throw new BadRequestException(
        `Não é possível excluir: resultaria em estoque negativo (${prospectiveQuantity} ${supply.unit})`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.supply.update({
        where: { id: supplyId },
        data: { currentQuantity: { increment: adjustment } },
      }),
      this.prisma.supplyMovement.delete({ where: { id: movementId } }),
    ]);

    return { success: true };
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
