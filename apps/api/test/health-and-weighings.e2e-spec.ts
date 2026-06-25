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
  currentWeightKg: number | null;
}

interface VaccinationResponseBody {
  id: string;
  administeredAt: string | null;
}

interface AlertResponseBody {
  id: string;
  animalId: string;
  overdue: boolean;
}

interface GainSummaryResponseBody {
  averageDailyGainKg: number;
  averageMonthlyGainKg: number;
  weighingsCount: number;
}

describe('Health records & Weighings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `health-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };

  let ownerToken: string;
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

    const farmRes = await request(app.getHttpServer())
      .post('/farms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Saúde' });
    farmId = (farmRes.body as FarmResponseBody).id;

    const animalRes = await request(app.getHttpServer())
      .post(`/farms/${farmId}/animals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'SAUDE-001', sex: 'MALE', category: 'BOI' });
    animalId = (animalRes.body as AnimalResponseBody).id;
  });

  afterAll(async () => {
    await prisma.animalEvent.deleteMany({ where: { animal: { farmId } } });
    await prisma.weighingRecord.deleteMany({ where: { animal: { farmId } } });
    await prisma.treatmentRecord.deleteMany({ where: { animal: { farmId } } });
    await prisma.vaccinationRecord.deleteMany({
      where: { animal: { farmId } },
    });
    await prisma.animal.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { email: owner.email } });
    await app.close();
  });

  describe('vaccinations & pending alerts', () => {
    let overdueVaccinationId: string;

    it('schedules an overdue vaccination', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 2);

      const res = await request(app.getHttpServer())
        .post(`/farms/${farmId}/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          vaccineName: 'Febre Aftosa',
          scheduledDate: past.toISOString(),
        })
        .expect(201);

      overdueVaccinationId = (res.body as VaccinationResponseBody).id;
    });

    it('schedules a vaccination far in the future (not yet an alert)', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 60);

      await request(app.getHttpServer())
        .post(`/farms/${farmId}/animals/${animalId}/vaccinations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ vaccineName: 'Brucelose', scheduledDate: future.toISOString() })
        .expect(201);
    });

    it('lists the overdue vaccination as a pending alert, but not the future one', async () => {
      const res = await request(app.getHttpServer())
        .get(`/farms/${farmId}/health/alerts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const alerts = res.body as AlertResponseBody[];
      const overdueAlert = alerts.find((a) => a.id === overdueVaccinationId);
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert?.overdue).toBe(true);
      expect(alerts.length).toBe(1);
    });

    it('marks the vaccination as applied, removing it from pending alerts', async () => {
      await request(app.getHttpServer())
        .patch(
          `/farms/${farmId}/animals/${animalId}/vaccinations/${overdueVaccinationId}/apply`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/farms/${farmId}/health/alerts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect((res.body as AlertResponseBody[]).length).toBe(0);
    });
  });

  describe('treatments', () => {
    it('creates and lists a treatment record', async () => {
      await request(app.getHttpServer())
        .post(`/farms/${farmId}/animals/${animalId}/treatments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          medication: 'Antibiótico X',
          diagnosis: 'Infecção respiratória',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/farms/${farmId}/animals/${animalId}/treatments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect((res.body as { medication: string }[]).length).toBe(1);
    });
  });

  describe('weighings & gain calculation', () => {
    it('records weighings and updates the animal current weight', async () => {
      const day0 = new Date();
      day0.setDate(day0.getDate() - 30);
      const day30 = new Date();

      await request(app.getHttpServer())
        .post(`/farms/${farmId}/animals/${animalId}/weighings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ weightKg: 300, weighedAt: day0.toISOString() })
        .expect(201);

      const secondRes = await request(app.getHttpServer())
        .post(`/farms/${farmId}/animals/${animalId}/weighings`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ weightKg: 330, weighedAt: day30.toISOString() })
        .expect(201);

      expect((secondRes.body as { weightKg: number }).weightKg).toBe(330);

      const animalRes = await request(app.getHttpServer())
        .get(`/farms/${farmId}/animals/${animalId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect((animalRes.body as AnimalResponseBody).currentWeightKg).toBe(330);
    });

    it('computes average daily and monthly gain from weighing history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/farms/${farmId}/animals/${animalId}/weighings/gain-summary`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const summary = res.body as GainSummaryResponseBody;
      expect(summary.weighingsCount).toBe(2);
      expect(summary.averageDailyGainKg).toBeCloseTo(1, 0);
      expect(summary.averageMonthlyGainKg).toBeCloseTo(30, 0);
    });
  });
});
