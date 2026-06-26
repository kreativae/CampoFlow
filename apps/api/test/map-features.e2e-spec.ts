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

interface MapFeatureResponseBody {
  id: string;
  coordinates: [number, number][];
}

describe('Map Features (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `map-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `map-consultant-${Date.now()}@campoflow.test`,
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
      .post('/farms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Mapa Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });
  });

  afterAll(async () => {
    await prisma.mapFeature.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('creates a point feature (nascente)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/farms/${farmId}/map-features`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Nascente do Córrego',
        type: 'NASCENTE',
        geometryType: 'PONTO',
        coordinates: [[-15.793889, -47.882778]],
      })
      .expect(201);

    expect((res.body as MapFeatureResponseBody).coordinates).toEqual([
      [-15.793889, -47.882778],
    ]);
  });

  it('rejects a point with more than one coordinate', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/map-features`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Ponto inválido',
        type: 'OUTRO',
        geometryType: 'PONTO',
        coordinates: [
          [-15.79, -47.88],
          [-15.8, -47.89],
        ],
      })
      .expect(400);
  });

  it('creates a polygon feature (cerca)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/farms/${farmId}/map-features`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Cerca do pasto 1',
        type: 'CERCA',
        geometryType: 'POLIGONO',
        coordinates: [
          [-15.79, -47.88],
          [-15.8, -47.88],
          [-15.8, -47.89],
        ],
      })
      .expect(201);

    expect((res.body as MapFeatureResponseBody).coordinates.length).toBe(3);
  });

  it('rejects a polygon with fewer than 3 coordinates', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/map-features`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Polígono inválido',
        type: 'RESERVA',
        geometryType: 'POLIGONO',
        coordinates: [
          [-15.79, -47.88],
          [-15.8, -47.89],
        ],
      })
      .expect(400);
  });

  it('rejects a consultant (read-only role) from creating a feature', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/map-features`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .send({
        name: 'Reserva indevida',
        type: 'RESERVA',
        geometryType: 'PONTO',
        coordinates: [[-15.79, -47.88]],
      })
      .expect(403);
  });

  it('lists all features for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/map-features`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(200);

    expect((res.body as MapFeatureResponseBody[]).length).toBe(2);
  });
});
