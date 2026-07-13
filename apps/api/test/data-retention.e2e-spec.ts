import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { FarmsService } from './../src/farms/farms.service';
import { CANCELED_DATA_RETENTION_DAYS } from './../src/billing/plans';

interface AuthResponseBody {
  accessToken: string;
}

interface FarmResponseBody {
  id: string;
}

describe('Canceled-account data retention (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let farmsService: FarmsService;

  const user = {
    email: `retention-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Retention User',
  };

  let accessToken: string;
  let accountId: string;
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
    farmsService = app.get(FarmsService);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);
    accessToken = (res.body as AuthResponseBody).accessToken;
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    accountId = dbUser!.accountId;

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda Retenção' });
    farmId = (farmRes.body as FarmResponseBody).id;
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.deleteMany({ where: { id: farmId } });
    await prisma.subscription.deleteMany({ where: { accountId } });
    await prisma.user.deleteMany({ where: { email: user.email } });
    await prisma.account.deleteMany({ where: { id: accountId } });
    await app.close();
  });

  it('does not purge a recently-canceled account', async () => {
    await prisma.subscription.update({
      where: { accountId },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });

    await farmsService.purgeCanceledAccountsData();

    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    expect(farm).not.toBeNull();
  });

  it('purges farm data once the retention window has passed', async () => {
    const longAgo = new Date(
      Date.now() - (CANCELED_DATA_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    await prisma.subscription.update({
      where: { accountId },
      data: { status: 'CANCELED', canceledAt: longAgo },
    });

    await farmsService.purgeCanceledAccountsData();

    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    expect(farm).toBeNull();

    // The account/user are kept (LGPD: the person can still log in).
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    expect(dbUser).not.toBeNull();
  });
});
