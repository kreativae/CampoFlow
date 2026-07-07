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
    await prisma.cropApplication.deleteMany({ where: { farmId } });
    await prisma.cropCycle.deleteMany({ where: { farmId } });
    await prisma.soilAnalysis.deleteMany({ where: { farmId } });
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

  it('#3 planting window flags a planting date outside the recommended months', async () => {
    // cycleId is Soja planted 2026-01-01; recommended window is out/nov/dez.
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/safras/${cycleId}/janela-plantio`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as {
      recognized: boolean;
      recommendedMonths: number[];
      plantedMonth: number;
      withinWindow: boolean | null;
    };
    expect(body.recognized).toBe(true);
    expect(body.recommendedMonths).toEqual([10, 11, 12]);
    expect(body.plantedMonth).toBe(1);
    expect(body.withinWindow).toBe(false);
  });

  it('#1 fertilizer/liming recommendation uses the latest soil analysis of the talhão', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mapFeatureId: otherMapFeatureId,
        collectedAt: '2026-01-10',
        ph: 5.2,
        baseSaturationPercent: 40,
        ctcCmolcDm3: 8,
        phosphorusMgDm3: 6,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/safras/${cycleId}/recomendacao`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as {
      fertilizer: {
        phosphorusKgPerHa: number;
        potassiumKgPerHa: number;
        phosphorusTotalKg: number;
      } | null;
      liming: { limestoneTonPerHa: number | null } | null;
      soilAnalysisId: string | null;
    };
    expect(body.soilAnalysisId).toBeTruthy();
    expect(body.fertilizer?.phosphorusKgPerHa).toBe(80); // Soja
    expect(body.fertilizer?.phosphorusTotalKg).toBe(1000); // 80 × 12.5 ha
    // V% 40 → alvo 60, CTC 8 → NC = 8 × 0.2 = 1.6 t/ha
    expect(body.liming?.limestoneTonPerHa).toBe(1.6);
  });

  it('#2 planting calculator computes totals and cost from area and rates', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/safras/calculadora-plantio`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        areaHectares: 10,
        seedRateKgPerHa: 60,
        seedPricePerKg: 5,
        fertilizerKgPerHa: 300,
        fertilizerPricePerKg: 4,
      })
      .expect(201);

    const body = res.body as {
      seedTotalKg: number;
      seedCost: number;
      fertilizerTotalKg: number;
      totalCost: number;
      costPerHa: number;
    };
    expect(body.seedTotalKg).toBe(600);
    expect(body.seedCost).toBe(3000);
    expect(body.fertilizerTotalKg).toBe(3000);
    expect(body.totalCost).toBe(15000); // 3000 + 12000
    expect(body.costPerHa).toBe(1500);
  });

  it('#6 rotation groups crop history by talhão', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/safras/rotacao`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as {
      mapFeatureId: string;
      history: { cropName: string }[];
    }[];
    const group = body.find((g) => g.mapFeatureId === otherMapFeatureId);
    expect(group).toBeTruthy();
    expect(group!.history.some((h) => h.cropName === 'Soja')).toBe(true);
  });

  it('#4 records, lists and deletes a field-book application', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/safras/${cycleId}/aplicacoes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'HERBICIDA',
        product: 'Glifosato',
        dosePerHa: 2.5,
        doseUnit: 'L/ha',
        preHarvestIntervalDays: 30,
        responsible: 'João Agrônomo',
      })
      .expect(201);
    const applicationId = (createRes.body as { id: string }).id;

    const listRes = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/safras/${cycleId}/aplicacoes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      (listRes.body as { id: string; product: string }[]).some(
        (a) => a.id === applicationId && a.product === 'Glifosato',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(
        `/fazendas/${farmId}/safras/${cycleId}/aplicacoes/${applicationId}`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ dosePerHa: 3 })
      .expect(200);

    await request(app.getHttpServer())
      .delete(
        `/fazendas/${farmId}/safras/${cycleId}/aplicacoes/${applicationId}`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
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
