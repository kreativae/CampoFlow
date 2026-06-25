import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeatherRecordDto } from './dto/create-weather-record.dto';

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

  // Active alerts: records with an alertType in the last 7 days, most recent first.
  async activeAlerts(farmId: string) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 7);

    return this.prisma.weatherRecord.findMany({
      where: {
        farmId,
        alertType: { not: null },
        recordedAt: { gte: windowStart },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
