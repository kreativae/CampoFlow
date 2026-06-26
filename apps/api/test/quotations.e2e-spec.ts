import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface QuotationResponseBody {
  id: string;
  commodity: string;
  price: number;
}

interface LatestQuotationBody {
  commodity: string;
  price: number;
  changePercent: number;
}

describe('Quotations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `quotations-user-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Quotations User',
  };

  let accessToken: string;

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
  });

  afterAll(async () => {
    await prisma.quotation.deleteMany({ where: { commodity: 'BOI_GORDO' } });
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/cotacoes/recente').expect(401);
  });

  it('creates an initial quotation', async () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);

    const res = await request(app.getHttpServer())
      .post('/cotacoes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        commodity: 'BOI_GORDO',
        price: 280,
        unit: 'R$/@',
        source: 'Manual',
        recordedAt: past.toISOString(),
      })
      .expect(201);

    expect((res.body as QuotationResponseBody).price).toBe(280);
  });

  it('creates a more recent quotation for the same commodity', async () => {
    await request(app.getHttpServer())
      .post('/cotacoes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        commodity: 'BOI_GORDO',
        price: 308,
        unit: 'R$/@',
        source: 'Manual',
      })
      .expect(201);
  });

  it('lists price history for the commodity, most recent first', async () => {
    const res = await request(app.getHttpServer())
      .get('/cotacoes?commodity=BOI_GORDO')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const history = res.body as QuotationResponseBody[];
    expect(history.length).toBe(2);
    expect(history[0].price).toBe(308);
    expect(history[1].price).toBe(280);
  });

  it('computes the latest price with percentage change vs. the previous record', async () => {
    const res = await request(app.getHttpServer())
      .get('/cotacoes/recente')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const latest = res.body as LatestQuotationBody[];
    const boiGordo = latest.find((q) => q.commodity === 'BOI_GORDO')!;
    expect(boiGordo.price).toBe(308);
    expect(boiGordo.changePercent).toBeCloseTo(10, 0); // (308-280)/280 = 10%
  });
});
