import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateFarmDto) {
    return this.prisma.farm.create({
      data: {
        name: dto.name,
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
}
