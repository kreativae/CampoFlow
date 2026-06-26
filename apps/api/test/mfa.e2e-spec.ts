import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { authenticator } from 'otplib';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  user?: { id: string; email: string; name: string };
  accessToken?: string;
  refreshToken?: string;
  mfaRequired?: boolean;
}

interface SetupMfaBody {
  secret: string;
  qrCodeDataUrl: string;
}

describe('MFA (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `mfa-user-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'MFA User',
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
    accessToken = (res.body as AuthResponseBody).accessToken!;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('logs in normally before MFA is enabled', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(201);

    expect((res.body as AuthResponseBody).accessToken).toBeDefined();
  });

  it('rejects enabling MFA without first calling setup', async () => {
    await request(app.getHttpServer())
      .post('/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '123456' })
      .expect(400);
  });

  it('rejects enabling MFA with an invalid code after setup', async () => {
    await request(app.getHttpServer())
      .post('/auth/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '000000' })
      .expect(401);
  });

  it('completes setup and enables MFA with a valid code', async () => {
    const setupRes = await request(app.getHttpServer())
      .post('/auth/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const { secret, qrCodeDataUrl } = setupRes.body as SetupMfaBody;
    expect(secret).toBeDefined();
    expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const code = authenticator.generate(secret);
    await request(app.getHttpServer())
      .post('/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(201);

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    expect(dbUser?.mfaEnabled).toBe(true);
    expect(dbUser?.mfaSecret).toBe(secret);
  });

  it('requires an MFA code on login once enabled', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(201);

    expect((res.body as AuthResponseBody).mfaRequired).toBe(true);
    expect((res.body as AuthResponseBody).accessToken).toBeUndefined();
  });

  it('rejects login with a wrong MFA code', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password, mfaCode: '000000' })
      .expect(401);
  });

  it('logs in successfully with a valid MFA code', async () => {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    const code = authenticator.generate(dbUser!.mfaSecret!);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password, mfaCode: code })
      .expect(201);

    expect((res.body as AuthResponseBody).accessToken).toBeDefined();
    accessToken = (res.body as AuthResponseBody).accessToken!;
  });

  it('disables MFA and allows login without a code again', async () => {
    await request(app.getHttpServer())
      .post('/auth/mfa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    expect(dbUser?.mfaEnabled).toBe(false);
    expect(dbUser?.mfaSecret).toBeNull();

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(201);
    expect((res.body as AuthResponseBody).accessToken).toBeDefined();
  });
});
