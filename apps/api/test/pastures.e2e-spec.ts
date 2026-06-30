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
  name: string;
  type: string;
}

interface PastureResponseBody {
  id: string;
  animalCapacity: number;
}

interface OccupationResponseBody {
  id: string;
  exitedAt: string | null;
}

describe('Properties & Pastures (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `farm-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `farm-consultant-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Consultant',
  };

  let ownerToken: string;
  let consultantToken: string;
  let farmId: string;
  let pastureId: string;

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
      .send({
        name: 'Fazenda Santa Luzia',
        type: 'FAZENDA',
        totalAreaHectares: 500,
        usableAreaHectares: 420,
        registryNumber: 'MAT-123',
      });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });
  });

  afterAll(async () => {
    await prisma.pastureOccupation.deleteMany({
      where: { pasture: { farmId } },
    });
    await prisma.pasture.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('creates a property with extended fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const farm = res.body as FarmResponseBody & { registryNumber: string };
    expect(farm.name).toBe('Fazenda Santa Luzia');
    expect(farm.registryNumber).toBe('MAT-123');
  });

  it('creates a pasture for the property', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Pasto 1',
        areaHectares: 20,
        grassType: 'Brachiaria',
        animalCapacity: 10,
      })
      .expect(201);

    const pasture = res.body as PastureResponseBody;
    expect(pasture.animalCapacity).toBe(10);
    pastureId = pasture.id;
  });

  it('a consultant (read-only role) can list pastures but not create one', async () => {
    await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/pastagens`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .send({ name: 'Pasto X', areaHectares: 5, animalCapacity: 5 })
      .expect(403);
  });

  it('allows entering a batch within capacity', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ headCount: 8, notes: 'Lote A' })
      .expect(201);

    expect((res.body as OccupationResponseBody).exitedAt).toBeNull();
  });

  it('rejects exceeding pasture capacity', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ headCount: 5 })
      .expect(400);
  });

  it('allows a batch to exit, freeing up capacity', async () => {
    const pastureRes = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/pastagens/${pastureId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const occupations = (
      pastureRes.body as { occupations: OccupationResponseBody[] }
    ).occupations;
    const active = occupations.find((o) => o.exitedAt === null)!;

    await request(app.getHttpServer())
      .patch(
        `/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes/${active.id}/saida`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ headCount: 9 })
      .expect(201);
  });

  describe('partial exit, editing, and moving between pastures', () => {
    let secondPastureId: string;

    it('creates a second pasture to move batches into', async () => {
      const res = await request(app.getHttpServer())
        .post(`/fazendas/${farmId}/pastagens`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Pasto 2', areaHectares: 15, animalCapacity: 10 })
        .expect(201);
      secondPastureId = (res.body as PastureResponseBody).id;
    });

    it('lets the owner edit an occupation record directly', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/fazendas/${farmId}/pastagens/${secondPastureId}/ocupacoes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ headCount: 6, notes: 'Lote B' })
        .expect(201);
      const occupationId = (createRes.body as OccupationResponseBody).id;

      const res = await request(app.getHttpServer())
        .patch(
          `/fazendas/${farmId}/pastagens/${secondPastureId}/ocupacoes/${occupationId}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ headCount: 7, notes: 'Lote B (corrigido)' })
        .expect(200);

      expect((res.body as { headCount: number }).headCount).toBe(7);
    });

    it('lets the owner exit only part of a batch, keeping the rest active', async () => {
      const pastureRes = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/pastagens/${secondPastureId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const active = (
        pastureRes.body as { occupations: OccupationResponseBody[] }
      ).occupations.find((o) => o.exitedAt === null)!;

      const exitRes = await request(app.getHttpServer())
        .patch(
          `/fazendas/${farmId}/pastagens/${secondPastureId}/ocupacoes/${active.id}/saida`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ headCount: 3, notes: 'Saída parcial' })
        .expect(200);

      expect((exitRes.body as { headCount: number }).headCount).toBe(3);
      expect((exitRes.body as OccupationResponseBody).exitedAt).not.toBeNull();

      const afterRes = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/pastagens/${secondPastureId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const occupations = (
        afterRes.body as {
          occupations: { headCount: number; exitedAt: string | null }[];
        }
      ).occupations;
      const stillActive = occupations.find((o) => o.exitedAt === null)!;
      expect(stillActive.headCount).toBe(4); // 7 - 3 remained active
    });

    it('lets the owner move a batch to another pasture when registering an exit', async () => {
      const thirdRes = await request(app.getHttpServer())
        .post(`/fazendas/${farmId}/pastagens`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Pasto 3', areaHectares: 12, animalCapacity: 10 })
        .expect(201);
      const thirdPastureId = (thirdRes.body as PastureResponseBody).id;

      const pastureRes = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/pastagens/${secondPastureId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const active = (
        pastureRes.body as { occupations: OccupationResponseBody[] }
      ).occupations.find((o) => o.exitedAt === null)!;

      await request(app.getHttpServer())
        .patch(
          `/fazendas/${farmId}/pastagens/${secondPastureId}/ocupacoes/${active.id}/saida`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ destinationPastureId: thirdPastureId })
        .expect(200);

      const thirdPastureRes = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/pastagens/${thirdPastureId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const thirdOccupations = (
        thirdPastureRes.body as {
          occupations: { headCount: number; exitedAt: string | null }[];
        }
      ).occupations;
      expect(
        thirdOccupations.some((o) => o.headCount === 4 && o.exitedAt === null),
      ).toBe(true);
    });
  });
});
