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

interface WeatherRecordResponseBody {
  id: string;
  alertType: string | null;
  temperatureC: number | null;
}

describe('Weather (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `weather-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `weather-consultant-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Consultant',
  };

  let ownerToken: string;
  let consultantToken: string;
  let farmId: string;

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

    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(owner);
    ownerToken = (ownerRes.body as AuthResponseBody).accessToken;

    const consultantRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(consultant);
    consultantToken = (consultantRes.body as AuthResponseBody).accessToken;

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Clima Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });
  });

  afterAll(async () => {
    await prisma.weatherRecord.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('records a normal weather reading', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/clima`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ temperatureC: 28, humidityPercent: 60, windSpeedKmh: 10 })
      .expect(201);

    expect((res.body as WeatherRecordResponseBody).temperatureC).toBe(28);
  });

  it('rejects a consultant (read-only role) from recording weather', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/clima`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .send({ temperatureC: 20 })
      .expect(403);
  });

  it('records a frost alert', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/clima`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        temperatureC: 1,
        alertType: 'GEADA',
        notes: 'Geada forte prevista',
      })
      .expect(201);

    expect((res.body as WeatherRecordResponseBody).alertType).toBe('GEADA');
  });

  it('returns the most recent record as latest', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/clima/recente`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(200);

    expect((res.body as WeatherRecordResponseBody).alertType).toBe('GEADA');
  });

  it('lists the frost alert as an active alert', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/clima/alertas`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(200);

    const alerts = res.body as WeatherRecordResponseBody[];
    expect(alerts.length).toBe(1);
    expect(alerts[0].alertType).toBe('GEADA');
  });

  it('lists full history with both records, most recent first', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/clima`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(200);

    const history = res.body as WeatherRecordResponseBody[];
    expect(history.length).toBe(2);
    expect(history[0].alertType).toBe('GEADA');
  });

  it('updates a weather record', async () => {
    const history = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/clima`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const target = (history.body as WeatherRecordResponseBody[])[0];

    const res = await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}/clima/${target.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'Corrigido via teste' })
      .expect(200);

    expect((res.body as { notes: string }).notes).toBe('Corrigido via teste');
  });

  it('removes a weather record', async () => {
    const before = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/clima`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const countBefore = (before.body as unknown[]).length;
    const target = (before.body as WeatherRecordResponseBody[])[0];

    await request(app.getHttpServer())
      .delete(`/fazendas/${farmId}/clima/${target.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/clima`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect((after.body as unknown[]).length).toBe(countBefore - 1);
  });
});
