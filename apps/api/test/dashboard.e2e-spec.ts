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

interface PastureResponseBody {
  id: string;
}

interface DashboardResponseBody {
  totalAnimals: number;
  averageWeightKg: number;
  averageDailyGainKg: number;
  stockingRate: {
    totalCapacity: number;
    occupiedHeadCount: number;
    occupancyRate: number;
  };
  currentMonthFinance: { receita: number; despesa: number; saldo: number };
  pendingAlerts: { id: string }[];
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `dash-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const employee = {
    email: `dash-employee-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Employee',
  };

  let ownerToken: string;
  let employeeToken: string;
  let farmId: string;
  let pastureId: string;
  let animalAId: string;

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

    const employeeRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(employee);
    employeeToken = (employeeRes.body as AuthResponseBody).accessToken;

    const farmRes = await request(app.getHttpServer())
      .post('/farms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Dashboard' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: employee.email, role: 'EMPLOYEE' });

    const pastureRes = await request(app.getHttpServer())
      .post(`/farms/${farmId}/pastures`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Pasto Dashboard', areaHectares: 10, animalCapacity: 10 });
    pastureId = (pastureRes.body as PastureResponseBody).id;

    const animalARes = await request(app.getHttpServer())
      .post(`/farms/${farmId}/animals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'DASH-A', sex: 'MALE', category: 'BOI', pastureId });
    animalAId = (animalARes.body as AnimalResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/animals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'DASH-B', sex: 'FEMALE', category: 'VACA', pastureId });

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/pastures/${pastureId}/occupations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ headCount: 2 });

    const day0 = new Date();
    day0.setDate(day0.getDate() - 10);
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/animals/${animalAId}/weighings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ weightKg: 300, weighedAt: day0.toISOString() });
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/animals/${animalAId}/weighings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ weightKg: 320 });

    const overdue = new Date();
    overdue.setDate(overdue.getDate() - 1);
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/animals/${animalAId}/vaccinations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        vaccineName: 'Febre Aftosa',
        scheduledDate: overdue.toISOString(),
      });

    const today = new Date().toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'RECEITA',
        category: 'VENDA_ANIMAL',
        amount: 3000,
        dueDate: today,
        paidAt: today,
      });
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'DESPESA',
        category: 'NUTRICAO',
        amount: 800,
        dueDate: today,
        paidAt: today,
      });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { farmId } });
    await prisma.animalEvent.deleteMany({ where: { animal: { farmId } } });
    await prisma.weighingRecord.deleteMany({ where: { animal: { farmId } } });
    await prisma.vaccinationRecord.deleteMany({
      where: { animal: { farmId } },
    });
    await prisma.animal.deleteMany({ where: { farmId } });
    await prisma.pastureOccupation.deleteMany({
      where: { pasture: { farmId } },
    });
    await prisma.pasture.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, employee.email] } },
    });
    await app.close();
  });

  it('rejects a non-privileged role (employee) from accessing the dashboard', async () => {
    await request(app.getHttpServer())
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('aggregates herd, stocking, finance, and alert data for the owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/dashboard`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const dashboard = res.body as DashboardResponseBody;
    expect(dashboard.totalAnimals).toBe(2);
    expect(dashboard.averageWeightKg).toBeCloseTo(320, 0); // only animal A has a recorded weight
    expect(dashboard.averageDailyGainKg).toBeCloseTo(2, 0); // 20kg over 10 days
    expect(dashboard.stockingRate.totalCapacity).toBe(10);
    expect(dashboard.stockingRate.occupiedHeadCount).toBe(2);
    expect(dashboard.stockingRate.occupancyRate).toBeCloseTo(0.2, 5);
    expect(dashboard.currentMonthFinance.receita).toBe(3000);
    expect(dashboard.currentMonthFinance.despesa).toBe(800);
    expect(dashboard.currentMonthFinance.saldo).toBe(2200);
    expect(dashboard.pendingAlerts.length).toBe(1);
  });
});
