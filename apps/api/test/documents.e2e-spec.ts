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

interface DocumentResponseBody {
  id: string;
  category: string;
  fileName: string;
}

describe('Documents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `documents-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const consultant = {
    email: `documents-consultant-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Consultant',
  };

  let ownerToken: string;
  let consultantToken: string;
  let farmId: string;
  let documentId: string;

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
      .send({ name: 'Fazenda Documentos Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: consultant.email, role: 'CONSULTANT' });
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, consultant.email] } },
    });
    await app.close();
  });

  it('uploads a document', async () => {
    const res = await request(app.getHttpServer())
      .post(`/farms/${farmId}/documents`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('category', 'GTA')
      .attach('file', Buffer.from('conteudo de teste da GTA'), 'gta-001.txt')
      .expect(201);

    const doc = res.body as DocumentResponseBody;
    expect(doc.category).toBe('GTA');
    expect(doc.fileName).toBe('gta-001.txt');
    documentId = doc.id;
  });

  it('rejects a consultant (read-only role) from uploading a document', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/documents`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .field('category', 'NFE')
      .attach('file', Buffer.from('nota fiscal'), 'nfe.txt')
      .expect(403);
  });

  it('lists documents for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/documents`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(200);

    expect(
      (res.body as DocumentResponseBody[]).some((d) => d.id === documentId),
    ).toBe(true);
  });

  it('downloads the uploaded document with the original content', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.text).toBe('conteudo de teste da GTA');
  });

  it('rejects a consultant from deleting a document', async () => {
    await request(app.getHttpServer())
      .delete(`/farms/${farmId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${consultantToken}`)
      .expect(403);
  });

  it('allows the owner to delete a document', async () => {
    await request(app.getHttpServer())
      .delete(`/farms/${farmId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/documents`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      (res.body as DocumentResponseBody[]).some((d) => d.id === documentId),
    ).toBe(false);
  });
});
