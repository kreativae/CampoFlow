import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

describe('Password reset (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `reset-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Reset User',
  };

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

    await request(app.getHttpServer()).post('/auth/register').send(user);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  // RESEND_API_KEY isn't configured in this environment, so the service falls back to
  // logging the reset URL via Logger.warn instead of actually e-mailing it. We capture
  // that log line to extract the raw token for testing the full flow end-to-end.
  async function captureResetUrl(
    action: () => Promise<unknown>,
  ): Promise<string> {
    let captured = '';
    const spy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message: unknown) => {
        const text = String(message);
        if (text.includes('redefinição')) {
          const match = text.match(/(http\S+)/);
          captured = match ? match[1] : '';
        }
      });
    try {
      await action();
    } finally {
      spy.mockRestore();
    }
    return captured;
  }

  it('does not reveal whether an e-mail is registered', async () => {
    const known = await request(app.getHttpServer())
      .post('/auth/esqueci-senha')
      .send({ email: user.email })
      .expect(201);
    const unknown = await request(app.getHttpServer())
      .post('/auth/esqueci-senha')
      .send({ email: 'never-registered@campoflow.test' })
      .expect(201);

    expect((known.body as { message: string }).message).toBe(
      (unknown.body as { message: string }).message,
    );
  });

  it('rejects an invalid or expired reset token', async () => {
    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token: 'not-a-real-token', newPassword: 'newpassword123' })
      .expect(400);
  });

  it('resets the password with a valid token and allows login with the new password', async () => {
    const resetUrl = await captureResetUrl(() =>
      request(app.getHttpServer())
        .post('/auth/esqueci-senha')
        .send({ email: user.email }),
    );
    const token = new URL(resetUrl).searchParams.get('token')!;
    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token, newPassword: 'newpassword123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'newpassword123' })
      .expect(201);
    expect((res.body as AuthResponseBody).accessToken).toBeDefined();
  });

  it('rejects reusing the same reset token twice', async () => {
    const resetUrl = await captureResetUrl(() =>
      request(app.getHttpServer())
        .post('/auth/esqueci-senha')
        .send({ email: user.email }),
    );
    const token = new URL(resetUrl).searchParams.get('token')!;

    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token, newPassword: 'anotherpassword123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/redefinir-senha')
      .send({ token, newPassword: 'yetanotherpassword123' })
      .expect(400);
  });
});
