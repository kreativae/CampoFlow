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

interface SupplyResponseBody {
  id: string;
  currentQuantity: number;
}

interface AlertResponseBody {
  id: string;
  lowStock: boolean;
  expiringSoon: boolean;
}

describe('Supplies (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `supplies-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `supplies-consultant-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Consultant',
  };

  let ownerToken: string;
  let consultantToken: string;
  let farmId: string;
  let supplyId: string;

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
      .send({ name: 'Fazenda Insumos Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/membros`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });
  });

  afterAll(async () => {
    await prisma.supplyMovement.deleteMany({ where: { supply: { farmId } } });
    await prisma.supply.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('creates a supply with an initial quantity', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sal Mineral',
        category: 'SAL_MINERAL',
        unit: 'kg',
        initialQuantity: 100,
        minimumQuantity: 20,
      })
      .expect(201);

    const supply = res.body as SupplyResponseBody;
    expect(supply.currentQuantity).toBe(100);
    supplyId = supply.id;
  });

  it('creates a supply without minimumQuantity, defaulting it to 0', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Cal Agrícola', category: 'FERTILIZANTE', unit: 'kg' })
      .expect(201);

    expect((res.body as { minimumQuantity: number }).minimumQuantity).toBe(0);
  });

  it('lets a custom category label be set when category is OUTROS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Vacina X',
        category: 'OUTROS',
        customCategory: 'Vacinas',
        unit: 'dose',
      })
      .expect(201);

    expect((res.body as { customCategory: string }).customCategory).toBe(
      'Vacinas',
    );
  });

  it('rejects a consultant (read-only role) from creating a supply', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .send({
        name: 'Ração',
        category: 'RACAO',
        unit: 'kg',
        minimumQuantity: 10,
      })
      .expect(403);
  });

  it('registers a stock exit, decreasing the current quantity', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos/${supplyId}/movimentacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'SAIDA', quantity: 70 })
      .expect(201);

    expect(res.body).toBeDefined();

    const supplyRes = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/insumos/${supplyId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect((supplyRes.body as SupplyResponseBody).currentQuantity).toBe(30);
  });

  it('rejects an exit larger than the current stock', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos/${supplyId}/movimentacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'SAIDA', quantity: 999 })
      .expect(400);
  });

  it('flags the supply as a low-stock alert once below the minimum', async () => {
    // current quantity is 30, minimum is 20: not yet low. Exit 15 more -> 15, below minimum.
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos/${supplyId}/movimentacoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'SAIDA', quantity: 15 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/insumos/alertas`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const alerts = res.body as AlertResponseBody[];
    const alert = alerts.find((a) => a.id === supplyId);
    expect(alert).toBeDefined();
    expect(alert?.lowStock).toBe(true);
  });

  it('flags a supply expiring soon as an alert', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);

    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/insumos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Defensivo X',
        category: 'DEFENSIVO',
        unit: 'L',
        initialQuantity: 50,
        minimumQuantity: 5,
        expirationDate: soon.toISOString(),
      })
      .expect(201);
    const expiringSupplyId = (res.body as SupplyResponseBody).id;

    const alertsRes = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/insumos/alertas`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const alerts = alertsRes.body as AlertResponseBody[];
    const alert = alerts.find((a) => a.id === expiringSupplyId);
    expect(alert).toBeDefined();
    expect(alert?.expiringSoon).toBe(true);
  });
});
