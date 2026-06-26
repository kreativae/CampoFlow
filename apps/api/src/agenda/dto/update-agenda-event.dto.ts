import { PartialType } from '@nestjs/mapped-types';
import { CreateAgendaEventDto } from './create-agenda-event.dto';

export class UpdateAgendaEventDto extends PartialType(CreateAgendaEventDto) {}
