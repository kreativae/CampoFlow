import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface AccountSummaryBody {
  id: string;
  planTier: string;
  status: string;
  farmsUsed: number;
}

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const admin = {
    email: `admin-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Platform Admin',
  };
  const regular = {
    email: `regular-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Regular User',
  };

  let adminToken: string;
  let regularToken: string;
  let regularAccountId: string;
  let regularUserId: string;

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_EMAILS = admin.email;

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

    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(admin);
    adminToken = (adminRes.body as AuthResponseBody).accessToken;

    const regularRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(regular);
    regularToken = (regularRes.body as AuthResponseBody).accessToken;
    const regularUser = await prisma.user.findUnique({
      where: { email: regular.email },
    });
    regularAccountId = regularUser!.accountId;
    regularUserId = regularUser!.id;
  });

  afterAll(async () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    const adminUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });
    // regular.email may have changed mid-suite (see the e-mail-change test), so
    // clean up by the ids captured at registration instead of re-looking-up by email.
    for (const dbUser of [
      adminUser,
      await prisma.user.findUnique({ where: { id: regularUserId } }),
    ]) {
      if (dbUser) {
        await prisma.membership.deleteMany({ where: { userId: dbUser.id } });
        await prisma.farm.deleteMany({
          where: { accountId: dbUser.accountId },
        });
        await prisma.subscription.deleteMany({
          where: { accountId: dbUser.accountId },
        });
        await prisma.user.delete({ where: { id: dbUser.id } });
        await prisma.account.delete({ where: { id: dbUser.accountId } });
      }
    }
    await app.close();
  });

  it('grants isPlatformAdmin automatically to emails in PLATFORM_ADMIN_EMAILS', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((res.body as { isPlatformAdmin: boolean }).isPlatformAdmin).toBe(
      true,
    );
  });

  it('does not create a trial subscription for platform staff registrations', async () => {
    const adminUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });
    const subscription = await prisma.subscription.findUnique({
      where: { accountId: adminUser!.accountId },
    });
    expect(subscription).toBeNull();
  });

  it('rejects a regular user from accessing /admin routes', async () => {
    await request(app.getHttpServer())
      .get('/admin/contas')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);
  });

  it('lets a platform admin list all accounts', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/contas')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = res.body as { items: AccountSummaryBody[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.some((a) => a.id === regularAccountId)).toBe(true);
  });

  it('lets a platform admin inspect a single account', async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/contas/${regularAccountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect((res.body as { id: string }).id).toBe(regularAccountId);
  });

  it('lets a platform admin override a subscription plan/status', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/contas/${regularAccountId}/assinatura`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planTier: 'PROFISSIONAL', status: 'ACTIVE' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/conta/assinatura')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    expect((res.body as { planTier: string; status: string }).planTier).toBe(
      'PROFISSIONAL',
    );
    expect((res.body as { planTier: string; status: string }).status).toBe(
      'ACTIVE',
    );
  });

  it('lets a platform admin edit account name/billingEmail/document', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/contas/${regularAccountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Conta Renomeada',
        billingEmail: 'financeiro@exemplo.test',
      })
      .expect(200);

    expect((res.body as { name: string }).name).toBe('Conta Renomeada');

    const detail = await request(app.getHttpServer())
      .get(`/admin/contas/${regularAccountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((detail.body as { billingEmail: string }).billingEmail).toBe(
      'financeiro@exemplo.test',
    );
    expect(detail.body as { paymentHistory: unknown[] }).toHaveProperty(
      'paymentHistory',
    );
  });

  it('lets a platform admin toggle isAccountAdmin for a member', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/contas/${regularAccountId}/usuarios/${regularUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isAccountAdmin: false })
      .expect(200);

    expect((res.body as { isAccountAdmin: boolean }).isAccountAdmin).toBe(
      false,
    );
  });

  it('blocks a regular user from editing account data', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/contas/${regularAccountId}`)
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ name: 'Hack' })
      .expect(403);
  });

  it("lets a platform admin change a member's email and reset their password", async () => {
    const newEmail = `regular-renamed-${Date.now()}@campoflow.test`;
    const res = await request(app.getHttpServer())
      .patch(`/admin/contas/${regularAccountId}/usuarios/${regularUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: newEmail,
        name: 'Regular Renamed',
        password: 'novaSenha123',
      })
      .expect(200);

    expect((res.body as { email: string }).email).toBe(newEmail);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: newEmail, password: 'novaSenha123' })
      .expect(201);
  });
});
