import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { AuthService } from './../src/auth/auth.service';

interface AuthResponseBody {
  user?: { id: string; email: string; name: string };
  accessToken?: string;
}

describe('Google OAuth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  const passwordUser = {
    email: `google-existing-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Existing Password User',
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
    authService = app.get(AuthService);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(passwordUser);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: passwordUser.email },
          { googleId: { startsWith: 'google-test-' } },
        ],
      },
    });
    await app.close();
  });

  // No real Google Cloud OAuth credentials exist in this environment, so the HTTP
  // redirect flow (/auth/google -> Google -> /auth/google/callback) can't be driven
  // end-to-end here. What IS fully testable without those credentials:
  // (a) the app boots and the routes are guarded correctly when not configured, and
  // (b) AuthService.loginWithGoogle's account-linking logic, called directly with a
  // fake decoded profile — exactly what GoogleStrategy.validate() would hand it.

  it('reports Google login as disabled when no credentials are configured', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/google/status')
      .expect(200);
    expect(res.body).toEqual({ enabled: false });
  });

  it('blocks /auth/google and /auth/google/callback with 503 when not configured', async () => {
    await request(app.getHttpServer()).get('/auth/google').expect(503);
    await request(app.getHttpServer()).get('/auth/google/callback').expect(503);
  });

  it('rejects password login for a Google-only account (no passwordHash)', async () => {
    const created = await authService.loginWithGoogle({
      googleId: 'google-test-only-account',
      email: `google-only-${Date.now()}@campoflow.test`,
      name: 'Google Only',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: 'anything' })
      .expect(401);
  });

  it('creates a new account on first Google login', async () => {
    const email = `google-new-${Date.now()}@campoflow.test`;
    const result = await authService.loginWithGoogle({
      googleId: 'google-test-new-user',
      email,
      name: 'Google New User',
    });

    expect(result.user.email).toBe(email);
    expect(result.accessToken).toBeDefined();

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.googleId).toBe('google-test-new-user');
    expect(dbUser?.passwordHash).toBeNull();
  });

  it('links Google to an existing password account with the same email', async () => {
    const result = await authService.loginWithGoogle({
      googleId: 'google-test-link-existing',
      email: passwordUser.email,
      name: passwordUser.name,
    });

    expect((result.user as AuthResponseBody['user'])?.email).toBe(
      passwordUser.email,
    );

    const dbUser = await prisma.user.findUnique({
      where: { email: passwordUser.email },
    });
    expect(dbUser?.googleId).toBe('google-test-link-existing');
    expect(dbUser?.passwordHash).not.toBeNull();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: passwordUser.email, password: passwordUser.password })
      .expect(201);
  });

  it('logs in the same user again on a subsequent Google login (matched by googleId)', async () => {
    const first = await authService.loginWithGoogle({
      googleId: 'google-test-repeat-login',
      email: `google-repeat-${Date.now()}@campoflow.test`,
      name: 'Repeat Login',
    });

    const second = await authService.loginWithGoogle({
      googleId: 'google-test-repeat-login',
      email: 'should-be-ignored@campoflow.test',
      name: 'Repeat Login',
    });

    expect(second.user.id).toBe(first.user.id);
    expect(second.user.email).toBe(first.user.email);
  });
});
