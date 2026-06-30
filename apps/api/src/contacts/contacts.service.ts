import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreateContactDto) {
    return this.prisma.contact.create({ data: { ...dto, farmId } });
  }

  findAll(farmId: string) {
    return this.prisma.contact.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(farmId: string, contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact || contact.farmId !== farmId) {
      throw new NotFoundException('Contato não encontrado');
    }
    return contact;
  }

  async update(farmId: string, contactId: string, dto: UpdateContactDto) {
    await this.findOne(farmId, contactId);
    return this.prisma.contact.update({ where: { id: contactId }, data: dto });
  }

  async remove(farmId: string, contactId: string) {
    await this.findOne(farmId, contactId);
    await this.prisma.contact.delete({ where: { id: contactId } });
    return { success: true };
  }
}
