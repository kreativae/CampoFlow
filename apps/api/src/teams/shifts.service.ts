import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(farmId: string, dto: CreateShiftDto) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_farmId: { userId: dto.userId, farmId } },
    });
    if (!membership) {
      throw new BadRequestException(
        'O usuário informado não é membro desta propriedade',
      );
    }

    return this.prisma.shift.create({
      data: {
        farmId,
        userId: dto.userId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        notes: dto.notes,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.shift.findMany({
      where: { farmId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { startDate: 'asc' },
    });
  }
}
