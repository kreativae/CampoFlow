import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface FarmResponseBody {
  id: string;
}

interface SubscriptionResponseBody {
  planTier: string;
  status: string;
  farmsUsed: number;
  farmsLimit: number | null;
}

describe('Billing (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `billing-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Billing User',
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
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (dbUser) {
      await prisma.membership.deleteMany({ where: { userId: dbUser.id } });
      await prisma.farm.deleteMany({ where: { accountId: dbUser.accountId } });
      await prisma.subscription.deleteMany({
        where: { accountId: dbUser.accountId },
      });
      await prisma.user.delete({ where: { id: dbUser.id } });
      await prisma.account.delete({ where: { id: dbUser.accountId } });
    }
    await app.close();
  });

  it('starts every new account on a TRIAL subscription capped at 2 farms', async () => {
    const res = await request(app.getHttpServer())
      .get('/conta/assinatura')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as SubscriptionResponseBody;
    expect(body.planTier).toBe('TRIAL');
    expect(body.status).toBe('TRIALING');
    expect(body.farmsUsed).toBe(0);
    expect(body.farmsLimit).toBe(2);
  });

  it('allows creating farms up to the plan limit', async () => {
    await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda 1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda 2' })
      .expect(201);
  });

  it('blocks creating a 3rd farm on the TRIAL/BASICO limit', async () => {
    const res = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda 3' })
      .expect(403);

    expect((res.body as { message: string }).message).toMatch(/2 fazenda/);
  });

  it('rejects checkout when Mercado Pago is not configured', async () => {
    await request(app.getHttpServer())
      .post('/conta/assinatura/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planTier: 'PROFISSIONAL' })
      .expect(400);
  });

  it('cancels the subscription and then blocks further mutating requests', async () => {
    await request(app.getHttpServer())
      .post('/conta/assinatura/cancelar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const subRes = await request(app.getHttpServer())
      .get('/conta/assinatura')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((subRes.body as SubscriptionResponseBody).status).toBe('CANCELED');

    // Mutating a regular resource should now be blocked...
    await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda pós-cancelamento' })
      .expect(403);

    // ...but billing routes stay reachable so the account can still react/reactivate.
    await request(app.getHttpServer())
      .get('/conta/assinatura')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
