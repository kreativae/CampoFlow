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

interface AnimalResponseBody {
  id: string;
}

interface PastureResponseBody {
  id: string;
}

interface DashboardResponseBody {
  totalAnimals: number;
  averageWeightKg: number;
  averageDailyGainKg: number;
  stockingRate: {
    totalCapacity: number;
    occupiedHeadCount: number;
    occupancyRate: number;
  };
  currentMonthFinance: { receita: number; despesa: number; saldo: number };
  pendingAlerts: { id: string }[];
}

interface FullOverviewResponseBody {
  herd: DashboardResponseBody;
  members: { total: number };
  supplies: { total: number; alertsCount: number };
  machines: { total: number };
  tasks: { total: number; openCount: number };
  agenda: { upcomingCount: number };
  map: { featuresCount: number; soilAnalysesCount: number };
  documents: { total: number };
  notifications: { unreadCount: number };
  quotations: unknown[];
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `dash-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const employee = {
    email: `dash-employee-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Employee',
  };

  let ownerToken: string;
  let employeeToken: string;
  let farmId: string;
  let pastureId: string;
  let animalAId: string;

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

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Dashboard' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: employee.email, role: 'EMPLOYEE' });

    const pastureRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Pasto Dashboard', areaHectares: 10, animalCapacity: 10 });
    pastureId = (pastureRes.body as PastureResponseBody).id;

    const animalARes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'DASH-A', sex: 'MALE', category: 'BOI', pastureId });
    animalAId = (animalARes.body as AnimalResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'DASH-B', sex: 'FEMALE', category: 'VACA', pastureId });

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ headCount: 2 });

    const day0 = new Date();
    day0.setDate(day0.getDate() - 10);
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${animalAId}/pesagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ weightKg: 300, weighedAt: day0.toISOString() });
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${animalAId}/pesagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ weightKg: 320 });

    const overdue = new Date();
    overdue.setDate(overdue.getDate() - 1);
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${animalAId}/vacinacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        vaccineName: 'Febre Aftosa',
        scheduledDate: overdue.toISOString(),
      });

    const today = new Date().toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/lancamentos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'RECEITA',
        category: 'VENDA_ANIMAL',
        amount: 3000,
        dueDate: today,
        paidAt: today,
      });
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/lancamentos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'DESPESA',
        category: 'NUTRICAO',
        amount: 800,
        dueDate: today,
        paidAt: today,
      });

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sal Mineral Dashboard',
        category: 'SAL_MINERAL',
        unit: 'kg',
        initialQuantity: 2,
        minimumQuantity: 20,
      });

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/maquinas`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Trator Dashboard', type: 'TRATOR' });

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/tarefas`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Tarefa Dashboard' });

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/agenda`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Evento Dashboard',
        type: 'MANEJO',
        scheduledDate: today,
      });

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/elementos-mapa`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Elemento Dashboard',
        type: 'OUTRO',
        geometryType: 'PONTO',
        coordinates: [[-21.78, -48.18]],
      });

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/documentos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('category', 'OUTRO')
      .attach('file', Buffer.from('documento dashboard'), 'doc.txt');

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/notificacoes/gerar`)
      .set('Authorization', `Bearer ${ownerToken}`);
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { farmId } });
    await prisma.animalEvent.deleteMany({ where: { animal: { farmId } } });
    await prisma.weighingRecord.deleteMany({ where: { animal: { farmId } } });
    await prisma.vaccinationRecord.deleteMany({
      where: { animal: { farmId } },
    });
    await prisma.animal.deleteMany({ where: { farmId } });
    await prisma.pastureOccupation.deleteMany({
      where: { pasture: { farmId } },
    });
    await prisma.pasture.deleteMany({ where: { farmId } });
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.document.deleteMany({ where: { farmId } });
    await prisma.mapFeature.deleteMany({ where: { farmId } });
    await prisma.agendaEvent.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
    await prisma.machine.deleteMany({ where: { farmId } });
    await prisma.supplyMovement.deleteMany({ where: { supply: { farmId } } });
    await prisma.supply.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, employee.email] } },
    });
    await app.close();
  });

  it('rejects a non-privileged role (employee) from accessing the dashboard', async () => {
    await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/painel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('aggregates herd, stocking, finance, and alert data for the owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/painel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const dashboard = res.body as DashboardResponseBody;
    expect(dashboard.totalAnimals).toBe(2);
    expect(dashboard.averageWeightKg).toBeCloseTo(320, 0); // only animal A has a recorded weight
    expect(dashboard.averageDailyGainKg).toBeCloseTo(2, 0); // 20kg over 10 days
    expect(dashboard.stockingRate.totalCapacity).toBe(10);
    expect(dashboard.stockingRate.occupiedHeadCount).toBe(2);
    expect(dashboard.stockingRate.occupancyRate).toBeCloseTo(0.2, 5);
    expect(dashboard.currentMonthFinance.receita).toBe(3000);
    expect(dashboard.currentMonthFinance.despesa).toBe(800);
    expect(dashboard.currentMonthFinance.saldo).toBe(2200);
    expect(dashboard.pendingAlerts.length).toBe(1);
  });

  it('rejects a non-privileged role (employee) from accessing the full summary', async () => {
    await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/painel/resumo`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('aggregates a summary block for every module, reusing each module own service', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/painel/resumo`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const body = res.body as FullOverviewResponseBody;
    expect(body.herd.totalAnimals).toBe(2);
    expect(body.members.total).toBe(2); // owner + employee
    expect(body.supplies.total).toBe(1);
    expect(body.supplies.alertsCount).toBe(1); // low stock
    expect(body.machines.total).toBe(1);
    expect(body.tasks.total).toBe(1);
    expect(body.tasks.openCount).toBe(1); // PENDENTE by default
    expect(body.agenda.upcomingCount).toBeGreaterThanOrEqual(1);
    expect(body.map.featuresCount).toBe(1);
    expect(body.map.soilAnalysesCount).toBe(0);
    expect(body.documents.total).toBe(1);
    expect(body.notifications.unreadCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.quotations)).toBe(true);
  });
});
