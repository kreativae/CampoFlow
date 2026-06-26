import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';

@Injectable()
export class WorkLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(farmId: string, userId: string, dto: CreateWorkLogDto) {
    if (dto.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: dto.taskId },
      });
      if (!task || task.farmId !== farmId) {
        throw new NotFoundException(
          'Tarefa informada não encontrada nesta propriedade',
        );
      }
    }

    return this.prisma.workLog.create({
      data: {
        farmId,
        userId,
        taskId: dto.taskId,
        description: dto.description,
        hoursWorked: dto.hoursWorked,
        workDate: dto.workDate ? new Date(dto.workDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.workLog.findMany({
      where: { farmId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { workDate: 'desc' },
    });
  }
}
