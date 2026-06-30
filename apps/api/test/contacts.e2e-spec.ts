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

interface ContactResponseBody {
  id: string;
  type: string;
  category: string;
  name: string;
  tradeName: string | null;
  document: string | null;
}

describe('Contacts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: `contacts-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Contacts User',
  };

  let accessToken: string;
  let farmId: string;
  let contactId: string;

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

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);
    accessToken = (res.body as AuthResponseBody).accessToken;

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fazenda Contatos Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('creates a pessoa física contact', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/contatos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'PESSOA_FISICA',
        category: 'VETERINARIO',
        name: 'Dra. Ana Souza',
        document: '123.456.789-00',
        phone: '11999990000',
        email: 'ana@example.com',
      })
      .expect(201);

    const body = res.body as ContactResponseBody;
    expect(body.type).toBe('PESSOA_FISICA');
    expect(body.name).toBe('Dra. Ana Souza');
    contactId = body.id;
  });

  it('creates a pessoa jurídica contact with tradeName', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/contatos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'PESSOA_JURIDICA',
        category: 'FORNECEDOR',
        name: 'Agropecuária Boa Vista Ltda',
        tradeName: 'Boa Vista Agro',
        document: '12.345.678/0001-90',
      })
      .expect(201);

    const body = res.body as ContactResponseBody;
    expect(body.type).toBe('PESSOA_JURIDICA');
    expect(body.tradeName).toBe('Boa Vista Agro');
  });

  it('defaults category to OUTRO when omitted', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/contatos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'PESSOA_FISICA', name: 'Sem categoria' })
      .expect(201);

    expect((res.body as ContactResponseBody).category).toBe('OUTRO');
  });

  it('lists contacts for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/contatos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((res.body as ContactResponseBody[]).length).toBe(3);
  });

  it('updates a contact', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/fazendas/${farmId}/contatos/${contactId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: '11888887777', category: 'CLIENTE' })
      .expect(200);

    const body = res.body as ContactResponseBody & { phone: string };
    expect(body.phone).toBe('11888887777');
    expect(body.category).toBe('CLIENTE');
  });

  it('deletes a contact', async () => {
    await request(app.getHttpServer())
      .delete(`/fazendas/${farmId}/contatos/${contactId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/contatos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      (res.body as ContactResponseBody[]).some((c) => c.id === contactId),
    ).toBe(false);
  });
});
