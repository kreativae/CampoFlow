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
}

interface CropCycleBody {
  id: string;
  cropName: string;
  mapFeatureId: string | null;
  status: 'PLANEJADA' | 'PLANTADA' | 'COLHIDA';
  harvestedAt: string | null;
}

describe('Crops / Safras (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `crops-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Crops User',
  };

  let accessToken: string;
  let farmId: string;
  let mapFeatureId: string;
  let otherMapFeatureId: string;
  let cycleId: string;

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
      .send({ name: 'Fazenda Safras Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    const featureRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/elementos-mapa`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Talhao 1',
        type: 'PASTAGEM',
        geometryType: 'PONTO',
        coordinates: [[-21.78, -48.18]],
      });
    mapFeatureId = (featureRes.body as MapFeatureResponseBody).id;

    const otherFeatureRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/elementos-mapa`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Talhao 2',
        type: 'PASTAGEM',
        geometryType: 'PONTO',
        coordinates: [[-21.8, -48.2]],
      });
    otherMapFeatureId = (otherFeatureRes.body as MapFeatureResponseBody).id;
  });

  afterAll(async () => {
    await prisma.cropCycle.deleteMany({ where: { farmId } });
    await prisma.mapFeature.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('rejects linking to a map feature from another farm context', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/safras`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mapFeatureId: '00000000-0000-0000-0000-000000000000',
        cropName: 'Soja',
        plantedAt: '2026-09-01',
      })
      .expect(404);
  });

  it('creates a crop cycle linked to a talhão, status PLANEJADA when planting is in the future', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/safras`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mapFeatureId,
        cropName: 'Soja',
        variety: 'BMX Potência',
        areaHectares: 12.5,
        plantedAt: '2099-09-01',
        expectedHarvestAt: '2100-01-15',
      })
      .expect(201);

    const body = res.body as CropCycleBody;
    expect(body.cropName).toBe('Soja');
    expect(body.mapFeatureId).toBe(mapFeatureId);
    expect(body.status).toBe('PLANEJADA');
    cycleId = body.id;
  });

  it('lists crop cycles for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/safras`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = res.body as CropCycleBody[];
    expect(list.some((c) => c.id === cycleId)).toBe(true);
  });

  it('updates a crop cycle and recomputes status to PLANTADA once planting date is in the past', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}/safras/${cycleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plantedAt: '2026-01-01' })
      .expect(200);

    expect((res.body as CropCycleBody).status).toBe('PLANTADA');
  });

  it('moves a crop cycle to a different talhão', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}/safras/${cycleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ mapFeatureId: otherMapFeatureId })
      .expect(200);

    expect((res.body as CropCycleBody).mapFeatureId).toBe(otherMapFeatureId);
  });

  it('rejects moving a crop cycle to a talhão from another farm context', async () => {
    await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}/safras/${cycleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ mapFeatureId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('registers the harvest, moving status to COLHIDA', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}/safras/${cycleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ harvestedAt: '2026-06-01', yieldKg: 45000 })
      .expect(200);

    const body = res.body as CropCycleBody;
    expect(body.status).toBe('COLHIDA');
    expect(body.harvestedAt).toBeTruthy();
  });

  it('deletes a crop cycle', async () => {
    await request(app.getHttpServer())
      .delete(`/fazendas/${farmId}/safras/${cycleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/safras`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((res.body as CropCycleBody[]).some((c) => c.id === cycleId)).toBe(
      false,
    );
  });
});
