import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface FarmResponseBody {
  id: string;
}

interface NotificationBody {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  source: string;
  read: boolean;
}

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `notif-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const employee = {
    email: `notif-employee-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Employee',
  };
  const outsider = {
    email: `notif-outsider-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Outsider',
  };

  let ownerToken: string;
  let employeeToken: string;
  let outsiderToken: string;
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

    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(owner);
    ownerToken = (ownerRes.body as AuthResponseBody).accessToken;

    const employeeRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(employee);
    employeeToken = (employeeRes.body as AuthResponseBody).accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(outsider);
    outsiderToken = (outsiderRes.body as AuthResponseBody).accessToken;

    const farmRes = await request(app.getHttpServer())
      .post('/farms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Notificações Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: employee.email, role: 'EMPLOYEE' });

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/supplies`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sal Mineral Notif',
        category: 'SAL_MINERAL',
        unit: 'kg',
        initialQuantity: 2,
        minimumQuantity: 20,
      });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.supplyMovement.deleteMany({ where: { supply: { farmId } } });
    await prisma.supply.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: {
        email: { in: [owner.email, employee.email, outsider.email] },
      },
    });
    await app.close();
  });

  it('rejects a user without access to the farm', async () => {
    await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('generates notifications for every farm member from pending alerts', async () => {
    const res = await request(app.getHttpServer())
      .post(`/farms/${farmId}/notifications/generate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect((res.body as { created: number }).created).toBeGreaterThan(0);

    const ownerList = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const employeeList = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const ownerNotifications = ownerList.body as NotificationBody[];
    const employeeNotifications = employeeList.body as NotificationBody[];

    expect(
      ownerNotifications.some((n) => n.message.includes('Sal Mineral Notif')),
    ).toBe(true);
    expect(
      employeeNotifications.some((n) =>
        n.message.includes('Sal Mineral Notif'),
      ),
    ).toBe(true);
    const inAppNotifications = ownerNotifications.filter(
      (n) => n.channel === 'IN_APP',
    );
    expect(inAppNotifications.length).toBeGreaterThan(0);
    expect(inAppNotifications.every((n) => n.status === 'SENT')).toBe(true);

    // RESEND_API_KEY isn't configured in this environment, so the per-user digest
    // e-mail is recorded as SIMULATED rather than actually sent.
    const emailDigest = ownerNotifications.find((n) => n.channel === 'EMAIL');
    expect(emailDigest?.status).toBe('SIMULATED');
  });

  it('does not duplicate notifications on a second generate call', async () => {
    const before = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const countBefore = (before.body as NotificationBody[]).length;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/notifications/generate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const countAfter = (after.body as NotificationBody[]).length;

    expect(countAfter).toBe(countBefore);
  });

  it('reports an accurate unread count and marks a single notification as read', async () => {
    const list = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const notifications = list.body as NotificationBody[];
    expect(notifications.length).toBeGreaterThan(0);
    const target = notifications[0];

    const countRes = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications/unread-count`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Number(countRes.text)).toBe(notifications.length);

    await request(app.getHttpServer())
      .patch(`/farms/${farmId}/notifications/${target.id}/read`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const countAfterRead = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications/unread-count`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Number(countAfterRead.text)).toBe(notifications.length - 1);

    const unreadOnly = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications?unreadOnly=true`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(
      (unreadOnly.body as NotificationBody[]).some((n) => n.id === target.id),
    ).toBe(false);
  });

  it('marks all remaining notifications as read', async () => {
    await request(app.getHttpServer())
      .patch(`/farms/${farmId}/notifications/read-all`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const countRes = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications/unread-count`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Number(countRes.text)).toBe(0);
  });

  it('keeps notifications isolated per user', async () => {
    const employeeList = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const employeeUnreadCount = await request(app.getHttpServer())
      .get(`/farms/${farmId}/notifications/unread-count`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect((employeeList.body as NotificationBody[]).length).toBeGreaterThan(0);
    expect(Number(employeeUnreadCount.text)).toBe(
      (employeeList.body as NotificationBody[]).length,
    );
  });
});
