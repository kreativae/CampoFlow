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

interface AgendaEventResponseBody {
  id: string;
  completedAt: string | null;
}

interface AgendaAlertResponseBody {
  id: string;
  overdue: boolean;
}

describe('Agenda (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `agenda-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `agenda-consultant-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Consultant',
  };

  let ownerToken: string;
  let consultantToken: string;
  let farmId: string;
  let overdueEventId: string;

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

    const consultantRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(consultant);
    consultantToken = (consultantRes.body as AuthResponseBody).accessToken;

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Agenda Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });
  });

  afterAll(async () => {
    await prisma.agendaEvent.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('creates an overdue event (manejo)', async () => {
    const past = new Date();
    past.setDate(past.getDate() - 2);

    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/agenda`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Repasse de pasto 2',
        type: 'MANEJO',
        scheduledDate: past.toISOString(),
      })
      .expect(201);

    overdueEventId = (res.body as AgendaEventResponseBody).id;
  });

  it('creates a future event (compra)', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 60);

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/agenda`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Comprar ração',
        type: 'COMPRA',
        scheduledDate: future.toISOString(),
      })
      .expect(201);
  });

  it('rejects a consultant (read-only role) from creating an event', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/agenda`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .send({
        title: 'Evento indevido',
        type: 'VENDA',
        scheduledDate: new Date().toISOString(),
      })
      .expect(403);
  });

  it('lists the overdue event as an alert, but not the far-future one', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/agenda/alertas`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(200);

    const alerts = res.body as AgendaAlertResponseBody[];
    const overdueAlert = alerts.find((a) => a.id === overdueEventId);
    expect(overdueAlert).toBeDefined();
    expect(overdueAlert?.overdue).toBe(true);
    expect(alerts.length).toBe(1);
  });

  it('marks the overdue event as completed, removing it from alerts', async () => {
    await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}/agenda/${overdueEventId}/concluir`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/agenda/alertas`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as AgendaAlertResponseBody[]).length).toBe(0);
  });

  it('lists all events for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/agenda`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as AgendaEventResponseBody[]).length).toBe(2);
  });
});
