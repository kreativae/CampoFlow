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

interface FarmResponseBody {
  id: string;
}

describe('Auth & Farms (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const employee = {
    email: `employee-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Employee',
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
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({
      where: { user: { email: { in: [owner.email, employee.email] } } },
    });
    await prisma.farm.deleteMany({ where: { memberships: { none: {} } } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, employee.email] } },
    });
    await app.close();
  });

  it('registers a new user and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(owner)
      .expect(201);

    const body = res.body as AuthResponseBody;
    expect(body.user.email).toBe(owner.email);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('rejects duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(owner)
      .expect(409);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password: owner.password })
      .expect(201);

    expect((res.body as AuthResponseBody).accessToken).toBeDefined();
  });

  it('rejects login with invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password: 'wrong-password' })
      .expect(401);
  });

  it('refreshes tokens with a valid refresh token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password: owner.password })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: (loginRes.body as AuthResponseBody).refreshToken })
      .expect(201);

    expect((res.body as AuthResponseBody).accessToken).toBeDefined();
  });

  it('rejects an invalid refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
  });

  describe('farms and role-based access', () => {
    let ownerAccessToken: string;
    let employeeAccessToken: string;
    let farmId: string;

    beforeAll(async () => {
      const ownerLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: owner.email, password: owner.password });
      ownerAccessToken = (ownerLogin.body as AuthResponseBody).accessToken;

      const employeeRegister = await request(app.getHttpServer())
        .post('/auth/register')
        .send(employee);
      employeeAccessToken = (employeeRegister.body as AuthResponseBody)
        .accessToken;

      const farmRes = await request(app.getHttpServer())
        .post('/farms')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: 'Fazenda Teste' })
        .expect(201);
      farmId = (farmRes.body as FarmResponseBody).id;
    });

    it('rejects unauthenticated access', async () => {
      await request(app.getHttpServer()).get('/farms').expect(401);
    });

    it('owner can list their farms', async () => {
      const res = await request(app.getHttpServer())
        .get('/farms')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const farms = res.body as FarmResponseBody[];
      expect(farms.some((f) => f.id === farmId)).toBe(true);
    });

    it('owner can add a member with a role', async () => {
      await request(app.getHttpServer())
        .post(`/farms/${farmId}/members`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ email: employee.email, role: 'EMPLOYEE' })
        .expect(201);
    });

    it('rejects a non-privileged user attempting to add a member', async () => {
      // employee's token does not yet carry the new membership (issued before being added),
      // so this exercises the RolesGuard rejecting users without a qualifying role on the farm.
      await request(app.getHttpServer())
        .post(`/farms/${farmId}/members`)
        .set('Authorization', `Bearer ${employeeAccessToken}`)
        .send({ email: owner.email, role: 'EMPLOYEE' })
        .expect(403);
    });

    it('lists members including the newly added employee', async () => {
      const res = await request(app.getHttpServer())
        .get(`/farms/${farmId}/members`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const members = res.body as { email: string; role: string }[];
      expect(
        members.some((m) => m.email === owner.email && m.role === 'OWNER'),
      ).toBe(true);
      expect(
        members.some(
          (m) => m.email === employee.email && m.role === 'EMPLOYEE',
        ),
      ).toBe(true);
    });

    it('rejects removing the sole owner of the farm', async () => {
      const ownerMember = (
        (
          await request(app.getHttpServer())
            .get(`/farms/${farmId}/members`)
            .set('Authorization', `Bearer ${ownerAccessToken}`)
        ).body as { userId: string; role: string }[]
      ).find((m) => m.role === 'OWNER')!;

      await request(app.getHttpServer())
        .delete(`/farms/${farmId}/members/${ownerMember.userId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(400);
    });

    it('rejects a non-owner removing a member', async () => {
      const members = (
        await request(app.getHttpServer())
          .get(`/farms/${farmId}/members`)
          .set('Authorization', `Bearer ${ownerAccessToken}`)
      ).body as { userId: string; email: string }[];
      const employeeMember = members.find((m) => m.email === employee.email)!;

      await request(app.getHttpServer())
        .delete(`/farms/${farmId}/members/${employeeMember.userId}`)
        .set('Authorization', `Bearer ${employeeAccessToken}`)
        .expect(403);
    });

    it('allows the owner to remove a member', async () => {
      const members = (
        await request(app.getHttpServer())
          .get(`/farms/${farmId}/members`)
          .set('Authorization', `Bearer ${ownerAccessToken}`)
      ).body as { userId: string; email: string }[];
      const employeeMember = members.find((m) => m.email === employee.email)!;

      await request(app.getHttpServer())
        .delete(`/farms/${farmId}/members/${employeeMember.userId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      const afterRes = await request(app.getHttpServer())
        .get(`/farms/${farmId}/members`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
      const afterMembers = afterRes.body as { email: string }[];
      expect(afterMembers.some((m) => m.email === employee.email)).toBe(false);
    });
  });
});
