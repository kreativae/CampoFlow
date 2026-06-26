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

interface AnimalResponseBody {
  id: string;
}

interface BiOverviewBody {
  kpis: {
    totalReceita: number;
    totalDespesa: number;
    lucro: number;
    arrobasProduzidas: number;
    custoPorArroba: number;
    lucroPorAnimal: number;
    roi: number;
    rentabilidade: number;
  };
  forecastWeightGain: {
    averageDailyGainKg: number;
    herdSize: number;
    projectedArrobas: number;
    weatherRiskActive: boolean;
  };
  forecastSales: {
    projectedNextMonthReceita: number;
  };
  managementSuggestions: string[];
}

describe('BI (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `bi-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `bi-consultant-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Consultant',
  };

  let ownerToken: string;
  let consultantToken: string;
  let farmId: string;
  let animalId: string;

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
      .send({ name: 'Fazenda BI Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });

    const animalRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'BI-0001', sex: 'MALE', category: 'BOI' });
    animalId = (animalRes.body as AnimalResponseBody).id;

    const day0 = new Date();
    day0.setDate(day0.getDate() - 30);
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${animalId}/pesagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ weightKg: 300, weighedAt: day0.toISOString() });
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${animalId}/pesagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ weightKg: 330 });

    const today = new Date().toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/lancamentos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'RECEITA',
        category: 'VENDA_ANIMAL',
        amount: 5000,
        dueDate: today,
        paidAt: today,
      });
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/lancamentos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'DESPESA',
        category: 'NUTRICAO',
        amount: 1000,
        dueDate: today,
        paidAt: today,
      });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { farmId } });
    await prisma.animalEvent.deleteMany({ where: { animal: { farmId } } });
    await prisma.weighingRecord.deleteMany({ where: { animal: { farmId } } });
    await prisma.animal.deleteMany({ where: { farmId } });
    await prisma.supplyMovement.deleteMany({ where: { supply: { farmId } } });
    await prisma.supply.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('rejects a consultant (read-only role) from accessing BI', async () => {
    await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/inteligencia`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(403);
  });

  it('computes herd/financial KPIs from real transaction and weighing data', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/inteligencia`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const body = res.body as BiOverviewBody;
    expect(body.kpis.totalReceita).toBe(5000);
    expect(body.kpis.totalDespesa).toBe(1000);
    expect(body.kpis.lucro).toBe(4000);
    expect(body.kpis.arrobasProduzidas).toBeCloseTo(2, 1); // 30kg gain / 15kg per arroba
    expect(body.kpis.custoPorArroba).toBeCloseTo(500, 0); // 1000 / 2
    expect(body.kpis.lucroPorAnimal).toBeCloseTo(4000, 0); // 1 active animal
    expect(body.kpis.roi).toBeCloseTo(4, 1); // 4000 / 1000
    expect(body.kpis.rentabilidade).toBeCloseTo(0.8, 1); // 4000 / 5000
  });

  it('forecasts weight gain from the herd average daily gain', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/inteligencia`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const body = res.body as BiOverviewBody;
    expect(body.forecastWeightGain.herdSize).toBe(1);
    expect(body.forecastWeightGain.averageDailyGainKg).toBeCloseTo(1, 0); // 30kg over 30 days
    expect(body.forecastWeightGain.weatherRiskActive).toBe(false);
    expect(body.forecastWeightGain.projectedArrobas).toBeCloseTo(2, 0); // 1kg/day * 1 animal * 30d / 15
  });

  it('forecasts next month revenue from recent cash flow', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/inteligencia`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      (res.body as BiOverviewBody).forecastSales.projectedNextMonthReceita,
    ).toBe(5000);
  });

  it('reports no critical suggestions when there are no pending alerts', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/inteligencia`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const suggestions = (res.body as BiOverviewBody).managementSuggestions;
    expect(suggestions).toContain(
      'Nenhuma pendência crítica identificada no momento.',
    );
  });

  it('surfaces a low-stock supply suggestion once a supply falls below minimum', async () => {
    const supplyRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sal Mineral BI',
        category: 'SAL_MINERAL',
        unit: 'kg',
        initialQuantity: 5,
        minimumQuantity: 20,
      })
      .expect(201);
    expect(supplyRes.body).toBeDefined();

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/inteligencia`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const suggestions = (res.body as BiOverviewBody).managementSuggestions;
    expect(suggestions.some((s) => s.includes('Sal Mineral BI'))).toBe(true);
  });
});
