import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface FarmResponseBody {
  id: string;
}

interface WeatherRecordBody {
  temperatureC: number;
  windSpeedKmh: number;
  source: string | null;
  recordedAt: string;
}

function fakeOpenMeteoResponse(
  time: string,
  temperature: number,
  windSpeed: number,
  weatherCode: number,
) {
  return {
    current: {
      time,
      temperature_2m: temperature,
      relative_humidity_2m: 70,
      wind_speed_10m: windSpeed,
      precipitation: 0,
      weather_code: weatherCode,
    },
  };
}

describe('External weather (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

  const user = {
    email: `ext-weather-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'External Weather User',
  };

  let accessToken: string;
  let farmId: string;
  let farmNoCoordsId: string;

  // Data das leituras simuladas: hoje. A rota de alertas só considera registros
  // dos últimos 7 dias, então datas fixas envelhecem e quebram o teste — usar a
  // data corrente mantém os registros sempre dentro da janela.
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);
    accessToken = (res.body as AuthResponseBody).accessToken;

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda Clima Externo Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ latitude: -21.78, longitude: -48.18 });

    const farmNoCoordsRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda Sem Coordenadas Teste' });
    farmNoCoordsId = (farmNoCoordsRes.body as FarmResponseBody).id;
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  afterAll(async () => {
    await prisma.weatherRecord.deleteMany({
      where: { farmId: { in: [farmId, farmNoCoordsId] } },
    });
    await prisma.membership.deleteMany({
      where: { farmId: { in: [farmId, farmNoCoordsId] } },
    });
    await prisma.farm.deleteMany({
      where: { id: { in: [farmId, farmNoCoordsId] } },
    });
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('refuses to auto-fetch for a farm without latitude/longitude', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmNoCoordsId}/clima/atualizar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('fetches and stores current weather, with no alert for mild conditions', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify(fakeOpenMeteoResponse(`${today}T13:00`, 22, 10, 1)),
        ),
      );

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/clima/atualizar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201)
      .expect({ created: true });

    const latest = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/clima/recente`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = latest.body as WeatherRecordBody;
    expect(body.temperatureC).toBe(22);
    expect(body.source).toBe('Open-Meteo');
  });

  it('does not duplicate when Open-Meteo reports the same reading timestamp again', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify(fakeOpenMeteoResponse(`${today}T13:00`, 22, 10, 1)),
        ),
      );

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/clima/atualizar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201)
      .expect({ created: false });
  });
});
