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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('fazendas/:farmId/contatos')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  create(@Param('farmId') farmId: string, @Body() dto: CreateContactDto) {
    return this.contactsService.create(farmId, dto);
  }

  @Get()
  @UseGuards(FarmAccessGuard)
  findAll(@Param('farmId') farmId: string) {
    return this.contactsService.findAll(farmId);
  }

  @Get(':contactId')
  @UseGuards(FarmAccessGuard)
  findOne(
    @Param('farmId') farmId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.findOne(farmId, contactId);
  }

  @Patch(':contactId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER, Role.EMPLOYEE)
  update(
    @Param('farmId') farmId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(farmId, contactId, dto);
  }

  @Delete(':contactId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(
    @Param('farmId') farmId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.remove(farmId, contactId);
  }
}
