import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FarmAccessGuard } from '../auth/guards/farm-access.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('fazendas/:farmId/tarefas')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Param('farmId') farmId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.tasksService.findAll(farmId);
  }

  @Get(':taskId')
  @UseGuards(FarmAccessGuard)
  findOne(@Param('farmId') farmId: string, @Param('taskId') taskId: string) {
    return this.tasksService.findOne(farmId, taskId);
  }

  // Broader roles than create/delete: any operational team member can update status on
  // their own (or any) task, e.g. marking it as in-progress or done.
  @Patch(':taskId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE, Role.VETERINARIAN)
  update(
    @Param('farmId') farmId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(farmId, taskId, dto);
  }

  @Delete(':taskId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('farmId') farmId: string, @Param('taskId') taskId: string) {
    return this.tasksService.remove(farmId, taskId);
  }
}
