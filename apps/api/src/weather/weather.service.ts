import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeatherRecordDto } from './dto/create-weather-record.dto';
import { UpdateWeatherRecordDto } from './dto/update-weather-record.dto';

@Injectable()
export class WeatherService {
  constructor(private readonly prisma: PrismaService) {}

  create(farmId: string, dto: CreateWeatherRecordDto) {
    return this.prisma.weatherRecord.create({
      data: {
        ...dto,
        farmId,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
      },
    });
  }

  async findOne(farmId: string, id: string) {
    const record = await this.prisma.weatherRecord.findUnique({
      where: { id },
    });
    if (!record || record.farmId !== farmId) {
      throw new NotFoundException('Registro de clima não encontrado');
    }
    return record;
  }

  async update(farmId: string, id: string, dto: UpdateWeatherRecordDto) {
    await this.findOne(farmId, id);
    return this.prisma.weatherRecord.update({
      where: { id },
      data: {
        ...dto,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
      },
    });
  }

  async remove(farmId: string, id: string) {
    await this.findOne(farmId, id);
    await this.prisma.weatherRecord.delete({ where: { id } });
    return { success: true };
  }

  history(farmId: string, limit = 50) {
    return this.prisma.weatherRecord.findMany({
      where: { farmId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  latest(farmId: string) {
    return this.prisma.weatherRecord.findFirst({
      where: { farmId },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
