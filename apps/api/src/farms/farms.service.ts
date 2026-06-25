import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateFarmDto) {
    return this.prisma.farm.create({
      data: {
        ...dto,
        memberships: {
          create: { userId: ownerId, role: Role.OWNER },
        },
      },
      include: { memberships: true },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.farm.findMany({
      where: { memberships: { some: { userId } } },
    });
  }

  async findOne(farmId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException('Propriedade não encontrada');
    }
    return farm;
  }

  async update(farmId: string, dto: UpdateFarmDto) {
    await this.findOne(farmId);
    return this.prisma.farm.update({ where: { id: farmId }, data: dto });
  }

  async remove(farmId: string) {
    await this.findOne(farmId);
    await this.prisma.farm.delete({ where: { id: farmId } });
    return { success: true };
  }

  async addMember(farmId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.prisma.membership.upsert({
      where: { userId_farmId: { userId: user.id, farmId } },
      update: { role: dto.role },
      create: { userId: user.id, farmId, role: dto.role },
    });
  }

  async listMembers(farmId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { farmId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    }));
  }

  async removeMember(farmId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_farmId: { userId, farmId } },
    });
    if (!membership) {
      throw new NotFoundException('Membro não encontrado nesta propriedade');
    }

    if (membership.role === Role.OWNER) {
      const ownerCount = await this.prisma.membership.count({
        where: { farmId, role: Role.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Não é possível remover o único proprietário da propriedade',
        );
      }
    }

    await this.prisma.membership.delete({
      where: { userId_farmId: { userId, farmId } },
    });
    return { success: true };
  }
}
