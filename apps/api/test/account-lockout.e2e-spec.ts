import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Account lockout & password policy (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `lockout-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Lockout User',
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
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (dbUser) {
      await prisma.subscription.deleteMany({
        where: { accountId: dbUser.accountId },
      });
      await prisma.user.delete({ where: { id: dbUser.id } });
      await prisma.account.delete({ where: { id: dbUser.accountId } });
    }
    await app.close();
  });

  it('rejects registration with a password that has no digits', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `weak-${Date.now()}@campoflow.test`,
        password: 'onlyletters',
        name: 'Weak Password',
      })
      .expect(400);
  });

  it('rejects registration with a password shorter than 8 characters', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `short-${Date.now()}@campoflow.test`,
        password: 'ab1',
        name: 'Short Password',
      })
      .expect(400);
  });

  it('locks the account after repeated wrong-password attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password' })
        .expect(401);
    }

    // 6th attempt, even with the CORRECT password, should now be refused because the
    // account is locked.
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    expect((res.body as { message: string }).message).toMatch(/bloqueada/);
  });
});
