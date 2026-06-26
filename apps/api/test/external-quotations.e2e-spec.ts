import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface RefreshResponseBody {
  created: number;
  skipped: number;
}

function fakeRedacaoAgroResponse(boiPrice: number, timestamp: string) {
  return {
    status: 'ok',
    commodities: {
      soja: { unidade: 'sc 60kg', valor: 130.5, timestamp },
      milho: { unidade: 'sc 60kg', valor: 73.1, timestamp },
      boi_gordo: { unidade: '@', valor: boiPrice, timestamp },
      cafe: { unidade: 'sc 60kg', valor: 1420, timestamp },
    },
  };
}

describe('External quotations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

  const user = {
    email: `ext-quotations-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'External Quotations User',
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

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  afterAll(async () => {
    await prisma.quotation.deleteMany({
      where: { source: 'Redação Agro (ref. CEPEA/ESALQ)' },
    });
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('fetches and stores quotations for the commodities present in our enum', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify(fakeRedacaoAgroResponse(300, '2026-06-26 13:00:00')),
        ),
      );

    const res = await request(app.getHttpServer())
      .post('/cotacoes/atualizar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const body = res.body as RefreshResponseBody;
    expect(body.created).toBe(3); // soja, milho, boi_gordo — cafe has no Commodity match
    expect(body.skipped).toBe(0);

    const stored = await prisma.quotation.findMany({
      where: { source: 'Redação Agro (ref. CEPEA/ESALQ)' },
    });
    expect(stored).toHaveLength(3);
    expect(
      stored.some((q) => q.commodity === 'BOI_GORDO' && q.price === 300),
    ).toBe(true);
  });

  it('skips re-inserting when the price has not changed since the last fetch', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify(fakeRedacaoAgroResponse(300, '2026-06-26 13:00:00')),
        ),
      );

    const res = await request(app.getHttpServer())
      .post('/cotacoes/atualizar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const body = res.body as RefreshResponseBody;
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(3);
  });

  it('creates a new record when the price changes', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify(fakeRedacaoAgroResponse(315, '2026-06-26 16:00:00')),
        ),
      );

    const res = await request(app.getHttpServer())
      .post('/cotacoes/atualizar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const body = res.body as RefreshResponseBody;
    expect(body.created).toBe(1); // only boi_gordo changed
    expect(body.skipped).toBe(2);

    const latest = await request(app.getHttpServer())
      .get('/cotacoes/recente')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const boiGordo = (
      latest.body as { commodity: string; price: number }[]
    ).find((q) => q.commodity === 'BOI_GORDO');
    expect(boiGordo?.price).toBe(315);
  });

  it('propagates a clear error when the external source is unavailable', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));

    await request(app.getHttpServer())
      .post('/cotacoes/atualizar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(500);
  });
});
