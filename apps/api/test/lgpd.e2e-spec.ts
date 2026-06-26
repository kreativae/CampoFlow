import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  user?: { id: string; email: string; name: string };
  accessToken?: string;
}

interface FarmResponseBody {
  id: string;
}

interface ExportBody {
  profile: { id: string; email: string; name: string };
  memberships: { farmId: string; farmName: string; role: string }[];
  notifications: unknown[];
}

describe('LGPD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const sole = {
    email: `lgpd-sole-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Sole Owner',
  };
  const coOwner = {
    email: `lgpd-co-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Co Owner',
  };
  const member = {
    email: `lgpd-member-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Plain Member',
  };

  let soleToken: string;
  let soleUserId: string;
  let memberToken: string;
  let memberUserId: string;
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

    const soleRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(sole);
    soleToken = (soleRes.body as AuthResponseBody).accessToken!;
    soleUserId = (soleRes.body as AuthResponseBody).user!.id;

    await request(app.getHttpServer()).post('/auth/register').send(coOwner);

    const memberRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(member);
    memberToken = (memberRes.body as AuthResponseBody).accessToken!;
    memberUserId = (memberRes.body as AuthResponseBody).user!.id;

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${soleToken}`)
      .send({ name: 'Fazenda LGPD Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${soleToken}`)
      .send({ email: member.email, role: 'EMPLOYEE' });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.deleteMany({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            sole.email,
            coOwner.email,
            member.email,
            `deleted-${memberUserId}@campoflow.invalid`,
            `deleted-${soleUserId}@campoflow.invalid`,
          ],
        },
      },
    });
    await app.close();
  });

  it('exports the personal data of the logged-in user', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me/export')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const body = res.body as ExportBody;
    expect(body.profile.email).toBe(member.email);
    expect(body.memberships.some((m) => m.farmId === farmId)).toBe(true);
  });

  it('refuses to delete the account of a sole farm owner', async () => {
    const res = await request(app.getHttpServer())
      .delete('/auth/me')
      .set('Authorization', `Bearer ${soleToken}`)
      .expect(409);

    expect((res.body as { message: string }).message).toContain(
      'Fazenda LGPD Teste',
    );
  });

  it('deletes (anonymizes) a regular member account and removes their membership', async () => {
    await request(app.getHttpServer())
      .delete('/auth/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const dbUser = await prisma.user.findUnique({
      where: { id: memberUserId },
    });
    expect(dbUser?.email).toBe(`deleted-${memberUserId}@campoflow.invalid`);
    expect(dbUser?.name).toBe('Usuário removido');

    const membership = await prisma.membership.findFirst({
      where: { userId: memberUserId, farmId },
    });
    expect(membership).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: member.email, password: member.password })
      .expect(401);
  });

  it('allows deleting the account once another owner takes over the farm', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${soleToken}`)
      .send({ email: coOwner.email, role: 'OWNER' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/auth/me')
      .set('Authorization', `Bearer ${soleToken}`)
      .expect(200);

    const dbUser = await prisma.user.findUnique({ where: { id: soleUserId } });
    expect(dbUser?.email).toBe(`deleted-${soleUserId}@campoflow.invalid`);

    const stillOwned = await prisma.membership.findFirst({
      where: { farmId, role: 'OWNER' },
    });
    expect(stillOwned).not.toBeNull();
  });
});
