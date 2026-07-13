import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

describe('Profile (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const userA = {
    email: `profile-a-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'User A',
  };
  const userB = {
    email: `profile-b-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'User B',
  };

  let tokenA: string;

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

    // Register both users
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send(userA)
      .expect(201);
    tokenA = (resA.body as AuthResponseBody).accessToken;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(userB)
      .expect(201);
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({
      where: { user: { email: { in: [userA.email, userB.email] } } },
    });
    await prisma.farm.deleteMany({ where: { memberships: { none: {} } } });
    // Clean up any email updates too
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [userA.email, userB.email, `updated-${userA.email}`],
        },
      },
    });
    await app.close();
  });

  // ── PATCH /auth/me ──────────────────────────────────────────────────

  describe('PATCH /auth/me', () => {
    it('updates name only', async () => {
      const res = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Nome Atualizado' })
        .expect(200);

      expect(res.body).toHaveProperty('name', 'Nome Atualizado');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('updates email to a unique email', async () => {
      const newEmail = `updated-${userA.email}`;
      const res = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: newEmail })
        .expect(200);

      expect(res.body).toHaveProperty('email', newEmail);

      // Restore original email so subsequent tests still work
      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: userA.email })
        .expect(200);
    });

    it('rejects email already in use', async () => {
      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: userB.email })
        .expect(409);
    });

    it('rejects unauthenticated request', async () => {
      await request(app.getHttpServer())
        .patch('/auth/me')
        .send({ name: 'Hacker' })
        .expect(401);
    });
  });

  // ── POST /auth/me/alterar-senha ─────────────────────────────────────

  describe('POST /auth/me/alterar-senha', () => {
    it('changes password with correct current password', async () => {
      const newPassword = 'novaSenha123';

      await request(app.getHttpServer())
        .post('/auth/me/alterar-senha')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ currentPassword: userA.password, newPassword })
        .expect(201);

      // Verify login works with new password
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userA.email, password: newPassword })
        .expect(201);

      // Restore original password for other tests
      await request(app.getHttpServer())
        .post('/auth/me/alterar-senha')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ currentPassword: newPassword, newPassword: userA.password })
        .expect(201);
    });

    it('rejects wrong current password', async () => {
      await request(app.getHttpServer())
        .post('/auth/me/alterar-senha')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: 'wrongPassword1',
          newPassword: 'novaSenha123',
        })
        .expect(400);
    });

    it('rejects weak new password (no digits)', async () => {
      await request(app.getHttpServer())
        .post('/auth/me/alterar-senha')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ currentPassword: userA.password, newPassword: 'onlyletters' })
        .expect(400);
    });

    it('rejects weak new password (too short)', async () => {
      await request(app.getHttpServer())
        .post('/auth/me/alterar-senha')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ currentPassword: userA.password, newPassword: 'ab1' })
        .expect(400);
    });

    it('rejects unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/auth/me/alterar-senha')
        .send({ currentPassword: userA.password, newPassword: 'novaSenha123' })
        .expect(401);
    });
  });
});
