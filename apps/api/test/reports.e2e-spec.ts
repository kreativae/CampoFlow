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

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `reports-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `reports-consultant-${Date.now()}@campoflow.test`,
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
      .send({ name: 'Fazenda Relatorios Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/animals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'REL-0001', sex: 'FEMALE', category: 'VACA' });

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'DESPESA',
        category: 'NUTRICAO',
        amount: 500,
        dueDate: '2026-06-01',
      });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { farmId } });
    await prisma.animal.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('rejects a consultant (read-only role) from accessing reports', async () => {
    await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/rebanho`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(403);
  });

  it('rejects an invalid report type', async () => {
    await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/invalido`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });

  it('rejects an invalid format', async () => {
    await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/rebanho?format=docx`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });

  it('downloads the herd report as CSV with the animal listed', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/rebanho?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('REL-0001');
  });

  it('downloads the finance report as XLSX with the correct content type', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/financeiro?format=xlsx`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
  });

  it('downloads the costs report as PDF with the correct content type', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/custos?format=pdf`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
  });

  it('defaults to CSV when no format is given', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/sanidade`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('downloads the reproduction report as CSV', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/reports/reproducao?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
  });
});
