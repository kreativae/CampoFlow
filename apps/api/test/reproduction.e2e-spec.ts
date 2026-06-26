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

interface ReproductiveStatsResponseBody {
  breedingEvents: number;
  pregnancyDiagnoses: number;
  confirmedPregnant: number;
  conceptionRate: number;
  pregnancyRate: number;
  births: number;
  abortions: number;
}

describe('Reproduction (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `repro-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };

  let ownerToken: string;
  let farmId: string;
  let cowAId: string;
  let cowBId: string;

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
      .post('/fazendas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Reprodução' });
    farmId = (farmRes.body as FarmResponseBody).id;

    const cowARes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'VACA-A', sex: 'FEMALE', category: 'VACA' });
    cowAId = (cowARes.body as AnimalResponseBody).id;

    const cowBRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'VACA-B', sex: 'FEMALE', category: 'VACA' });
    cowBId = (cowBRes.body as AnimalResponseBody).id;
  });

  afterAll(async () => {
    await prisma.animalEvent.deleteMany({ where: { animal: { farmId } } });
    await prisma.reproductiveEvent.deleteMany({
      where: { animal: { farmId } },
    });
    await prisma.animal.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { email: owner.email } });
    await app.close();
  });

  it('records a breeding event (IATF) for cow A', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'IATF' })
      .expect(201);
  });

  it('records a breeding event (monta natural) for cow B', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${cowBId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'MONTA_NATURAL' })
      .expect(201);
  });

  it('diagnoses cow A as pregnant and cow B as not pregnant', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'DIAGNOSTICO_PRENHEZ', result: 'PRENHE' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${cowBId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'DIAGNOSTICO_PRENHEZ', result: 'VAZIA' })
      .expect(201);
  });

  it('records a birth for cow A', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'PARTO' })
      .expect(201);
  });

  it('lists the reproductive history for a single animal', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as { type: string }[]).length).toBe(3);
  });

  it('computes farm-level conception and pregnancy rates', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/reproducao/estatisticas`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const stats = res.body as ReproductiveStatsResponseBody;
    expect(stats.breedingEvents).toBe(2);
    expect(stats.pregnancyDiagnoses).toBe(2);
    expect(stats.confirmedPregnant).toBe(1);
    expect(stats.conceptionRate).toBeCloseTo(0.5, 5);
    expect(stats.pregnancyRate).toBeCloseTo(0.5, 5);
    expect(stats.births).toBe(1);
    expect(stats.abortions).toBe(0);
  });

  it('updates a reproductive event', async () => {
    const list = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const target = (list.body as { id: string; type: string }[])[0];

    const res = await request(app.getHttpServer())
      .patch(
        `/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos/${target.id}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'Atualizado via teste' })
      .expect(200);

    expect((res.body as { notes: string }).notes).toBe('Atualizado via teste');
  });

  it('removes a reproductive event', async () => {
    const before = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const countBefore = (before.body as unknown[]).length;
    const target = (before.body as { id: string }[])[0];

    await request(app.getHttpServer())
      .delete(
        `/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos/${target.id}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/animais/${cowAId}/eventos-reprodutivos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect((after.body as unknown[]).length).toBe(countBefore - 1);
  });
});
