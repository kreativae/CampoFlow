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

interface SoilAnalysisBody {
  id: string;
  mapFeatureId: string | null;
  documentPath: string | null;
  documentFileName: string | null;
  ph: number;
  baseSaturationPercent: number;
  ctcCmolcDm3: number;
}

interface RecommendationBody {
  limingNeeded: boolean;
  limestoneTonPerHa: number | null;
  targetBaseSaturationPercent: number;
  notes: string[];
}

describe('Soil analysis (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `soil-analysis-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Soil Analysis User',
  };

  let accessToken: string;
  let farmId: string;
  let mapFeatureId: string;

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
      .send({ name: 'Fazenda Solo Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    const featureRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/elementos-mapa`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Pasto 3',
        type: 'PASTAGEM',
        geometryType: 'PONTO',
        coordinates: [[-21.78, -48.18]],
      });
    mapFeatureId = (featureRes.body as MapFeatureResponseBody).id;
  });

  afterAll(async () => {
    await prisma.soilAnalysis.deleteMany({ where: { farmId } });
    await prisma.mapFeature.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('rejects linking to a map feature from another farm context', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('mapFeatureId', '00000000-0000-0000-0000-000000000000')
      .field('collectedAt', '2026-06-01')
      .expect(404);
  });

  it('creates a soil analysis with an attached PDF lab report', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('mapFeatureId', mapFeatureId)
      .field('collectedAt', '2026-06-01')
      .field('ph', '4.8')
      .field('phosphorusMgDm3', '8')
      .field('potassiumCmolcDm3', '0.12')
      .field('ctcCmolcDm3', '8')
      .field('baseSaturationPercent', '40')
      .field('organicMatterPercent', '1.2')
      .attach('documento', Buffer.from('laudo de teste'), 'laudo.txt')
      .expect(201);

    const body = res.body as SoilAnalysisBody;
    expect(body.mapFeatureId).toBe(mapFeatureId);
    expect(body.documentFileName).toBe('laudo.txt');
    expect(body.documentPath).toBeTruthy();
  });

  it('lists analyses for the farm, optionally filtered by map feature', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo?mapFeatureId=${mapFeatureId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body as SoilAnalysisBody[]).toHaveLength(1);
  });

  it('downloads the attached PDF with its original content and file name', async () => {
    const list = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const analysisId = (list.body as SoilAnalysisBody[])[0].id;

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo/${analysisId}/baixar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.text).toBe('laudo de teste');
    expect(res.headers['content-disposition']).toContain('laudo.txt');
  });

  it('computes the liming recommendation using the base saturation method', async () => {
    const list = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const analysisId = (list.body as SoilAnalysisBody[])[0].id;

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo/${analysisId}/recomendacao`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as RecommendationBody;
    // NC = CTC * (target - current) / 100 = 8 * (70 - 40) / 100 = 2.4 t/ha
    expect(body.limingNeeded).toBe(true);
    expect(body.limestoneTonPerHa).toBeCloseTo(2.4, 2);
    expect(body.notes.some((n) => n.includes('Fósforo'))).toBe(true);
    expect(body.notes.some((n) => n.includes('Potássio'))).toBe(true);
  });

  it('respects a custom target base saturation passed as a query param', async () => {
    const list = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const analysisId = (list.body as SoilAnalysisBody[])[0].id;

    const res = await request(app.getHttpServer())
      .get(
        `/fazendas/${farmId}/analises-solo/${analysisId}/recomendacao?metaSaturacao=60`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // NC = 8 * (60 - 40) / 100 = 1.6 t/ha
    expect((res.body as RecommendationBody).limestoneTonPerHa).toBeCloseTo(
      1.6,
      2,
    );
  });

  it('builds a history series for the linked map feature, oldest first', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('mapFeatureId', mapFeatureId)
      .field('collectedAt', '2026-12-01')
      .field('ph', '5.8')
      .field('ctcCmolcDm3', '8')
      .field('baseSaturationPercent', '65')
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(
        `/fazendas/${farmId}/analises-solo/historico?mapFeatureId=${mapFeatureId}`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const history = res.body as SoilAnalysisBody[];
    expect(history).toHaveLength(2);
    expect(new Date(history[0].ph ? history[0].ph : 0)).toBeDefined();
    expect(history[0].ph).toBe(4.8);
    expect(history[1].ph).toBe(5.8);
  });

  it('removes an analysis and its attached document', async () => {
    const list = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const target = (list.body as SoilAnalysisBody[]).find(
      (a) => a.documentPath,
    );

    await request(app.getHttpServer())
      .delete(`/fazendas/${farmId}/analises-solo/${target!.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/analises-solo/${target!.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
