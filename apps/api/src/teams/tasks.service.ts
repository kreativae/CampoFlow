import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAssigneeIsMember(farmId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_farmId: { userId, farmId } },
    });
    if (!membership) {
      throw new BadRequestException(
        'O usuário informado não é membro desta propriedade',
      );
    }
  }

  async create(farmId: string, dto: CreateTaskDto) {
    if (dto.assignedToId) {
      await this.assertAssigneeIsMember(farmId, dto.assignedToId);
    }

    return this.prisma.task.create({
      data: {
        farmId,
        title: dto.title,
        description: dto.description,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  findAll(farmId: string) {
    return this.prisma.task.findMany({
      where: { farmId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(farmId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    if (!task || task.farmId !== farmId) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    return task;
  }

  async update(farmId: string, taskId: string, dto: UpdateTaskDto) {
    await this.findOne(farmId, taskId);
    if (dto.assignedToId) {
      await this.assertAssigneeIsMember(farmId, dto.assignedToId);
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt:
          dto.status === TaskStatus.CONCLUIDA ? new Date() : undefined,
      },
    });
  }

  async remove(farmId: string, taskId: string) {
    await this.findOne(farmId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
    return { success: true };
  }
}
