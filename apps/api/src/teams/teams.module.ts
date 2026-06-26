import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { WorkLogsService } from './work-logs.service';
import { WorkLogsController } from './work-logs.controller';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';

@Module({
  providers: [TasksService, WorkLogsService, ShiftsService],
  controllers: [TasksController, WorkLogsController, ShiftsController],
  exports: [TasksService, WorkLogsService, ShiftsService],
})
export class TeamsModule {}
