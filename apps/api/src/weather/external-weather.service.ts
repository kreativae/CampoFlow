import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WeatherAlertType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const SOURCE_LABEL = 'Open-Meteo';
const FROST_THRESHOLD_C = 3;
const STRONG_WIND_THRESHOLD_KMH = 50;
// WMO weather codes: https://open-meteo.com/en/docs (codes 95/96/99 = thunderstorm).
const HAIL_CODES = new Set([96, 99]);
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation: number;
    weather_code: number;
  };
}

// Open-Meteo is a genuinely free weather API (no key, no rate limit for reasonable
// use, CC BY 4.0 — commercial use allowed with attribution), unlike the unofficial
// quotations source. Only farms with latitude/longitude set (via the map module) can
// be auto-updated; farms without coordinates stay manual-only.
@Injectable()
export class ExternalWeatherService {
  private readonly logger = new Logger(ExternalWeatherService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs every 3 hours, same cadence as the quotations auto-refresh.
  @Cron('0 */3 * * *')
  async scheduledRefreshAll() {
    const farms = await this.prisma.farm.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true },
    });

    let created = 0;
    for (const farm of farms) {
      try {
        const result = await this.refreshForFarm(farm.id);
        if (result.created) created += 1;
      } catch (err) {
        this.logger.warn(
          `Falha ao atualizar clima da fazenda ${farm.id}: ${(err as Error).message}`,
        );
      }
    }
    if (created > 0) {
      this.logger.log(`Clima automático atualizado para ${created} fazenda(s)`);
    }
  }

  async refreshForFarm(farmId: string): Promise<{ created: boolean }> {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm?.latitude || !farm?.longitude) {
      throw new BadRequestException(
        'Esta fazenda não tem latitude/longitude cadastradas (defina no Mapa) — não é possível buscar o clima automaticamente.',
      );
    }

    const data = await this.fetchCurrent(farm.latitude, farm.longitude);
    const recordedAt = new Date(data.current.time);

    const lastAuto = await this.prisma.weatherRecord.findFirst({
      where: { farmId, source: SOURCE_LABEL },
      orderBy: { recordedAt: 'desc' },
    });
    if (lastAuto && lastAuto.recordedAt.getTime() === recordedAt.getTime()) {
      return { created: false };
    }

    await this.prisma.weatherRecord.create({
      data: {
        farmId,
        temperatureC: data.current.temperature_2m,
        humidityPercent: data.current.relative_humidity_2m,
        windSpeedKmh: data.current.wind_speed_10m,
        rainfallMm: data.current.precipitation,
        alertType: this.inferAlertType(data.current),
        source: SOURCE_LABEL,
        recordedAt,
      },
    });

    return { created: true };
  }

  private inferAlertType(
    current: OpenMeteoResponse['current'],
  ): WeatherAlertType | undefined {
    if (current.temperature_2m <= FROST_THRESHOLD_C)
      return WeatherAlertType.GEADA;
    if (HAIL_CODES.has(current.weather_code)) return WeatherAlertType.GRANIZO;
    if (THUNDERSTORM_CODES.has(current.weather_code))
      return WeatherAlertType.TEMPESTADE;
    if (current.wind_speed_10m >= STRONG_WIND_THRESHOLD_KMH)
      return WeatherAlertType.VENTO_FORTE;
    return undefined;
  }

  private async fetchCurrent(
    latitude: number,
    longitude: number,
  ): Promise<OpenMeteoResponse> {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code',
    );
    url.searchParams.set('timezone', 'America/Sao_Paulo');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo respondeu ${response.status}`);
    }
    return (await response.json()) as OpenMeteoResponse;
  }
}
