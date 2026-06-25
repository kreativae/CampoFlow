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

interface TransactionResponseBody {
  id: string;
  paidAt: string | null;
}

interface CashFlowBucket {
  period: string;
  receita: number;
  despesa: number;
  saldo: number;
}

describe('Finance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `finance-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `finance-consultant-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Consultant',
  };

  let ownerToken: string;
  let consultantToken: string;
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

    const consultantRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(consultant);
    consultantToken = (consultantRes.body as AuthResponseBody).accessToken;

    const farmRes = await request(app.getHttpServer())
      .post('/farms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Financeiro' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('creates a payable (despesa) transaction', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'DESPESA',
        category: 'NUTRICAO',
        amount: 1000,
        dueDate: '2026-01-10',
        paidAt: '2026-01-10',
      })
      .expect(201);
  });

  it('creates a receivable (receita) transaction in the same month', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'RECEITA',
        category: 'VENDA_ANIMAL',
        amount: 5000,
        dueDate: '2026-01-15',
        paidAt: '2026-01-15',
      })
      .expect(201);
  });

  it('creates a pending (unpaid) transaction in a different month', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'DESPESA',
        category: 'COMBUSTIVEL',
        amount: 200,
        dueDate: '2026-02-05',
      })
      .expect(201);
  });

  it('rejects a non-privileged role (consultant) from accessing finance', async () => {
    await request(app.getHttpServer())
      .get(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(403);
  });

  it('lists all transactions for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as TransactionResponseBody[]).length).toBe(3);
  });

  it('computes monthly cash flow with revenue, expense and balance', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/finance/cash-flow?granularity=monthly`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const buckets = res.body as CashFlowBucket[];
    const january = buckets.find((b) => b.period === '2026-01');
    const february = buckets.find((b) => b.period === '2026-02');

    expect(january).toBeDefined();
    expect(january?.receita).toBe(5000);
    expect(january?.despesa).toBe(1000);
    expect(january?.saldo).toBe(4000);

    expect(february).toBeDefined();
    expect(february?.despesa).toBe(200);
    expect(february?.saldo).toBe(-200);
  });

  it('marks a transaction as paid', async () => {
    const listRes = await request(app.getHttpServer())
      .get(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const unpaid = (listRes.body as TransactionResponseBody[]).find(
      (t) => t.paidAt === null,
    )!;

    const res = await request(app.getHttpServer())
      .patch(`/farms/${farmId}/transactions/${unpaid.id}/pay`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as TransactionResponseBody).paidAt).not.toBeNull();
  });
});
