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

interface PastureResponseBody {
  id: string;
}

interface AnimalResponseBody {
  id: string;
  earTag: string;
  pastureId: string | null;
  farmId: string;
}

interface AnimalEventResponseBody {
  id: string;
  type: string;
}

describe('Animals (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `animal-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };

  let ownerToken: string;
  let farmId: string;
  let secondFarmId: string;
  let pastureAId: string;
  let pastureBId: string;
  let animalId: string;

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

    const farmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda do Rebanho' });
    farmId = (farmRes.body as FarmResponseBody).id;

    const secondFarmRes = await request(app.getHttpServer())
      .post('/fazendas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Vizinha' });
    secondFarmId = (secondFarmRes.body as FarmResponseBody).id;

    const pastureARes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Pasto A', areaHectares: 10, animalCapacity: 5 });
    pastureAId = (pastureARes.body as PastureResponseBody).id;

    const pastureBRes = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/pastagens`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Pasto B', areaHectares: 10, animalCapacity: 5 });
    pastureBId = (pastureBRes.body as PastureResponseBody).id;
  });

  afterAll(async () => {
    await prisma.animalEvent.deleteMany({
      where: { animal: { farmId: { in: [farmId, secondFarmId] } } },
    });
    await prisma.animal.deleteMany({
      where: { farmId: { in: [farmId, secondFarmId] } },
    });
    await prisma.pasture.deleteMany({
      where: { farmId: { in: [farmId, secondFarmId] } },
    });
    await prisma.membership.deleteMany({
      where: { farmId: { in: [farmId, secondFarmId] } },
    });
    await prisma.farm.deleteMany({
      where: { id: { in: [farmId, secondFarmId] } },
    });
    await prisma.user.deleteMany({ where: { email: owner.email } });
    await app.close();
  });

  it('creates an animal in a pasture', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        earTag: 'BR-0001',
        sex: 'FEMALE',
        category: 'VACA',
        breed: 'Nelore',
        currentWeightKg: 420,
        pastureId: pastureAId,
      })
      .expect(201);

    const animal = res.body as AnimalResponseBody;
    expect(animal.earTag).toBe('BR-0001');
    expect(animal.pastureId).toBe(pastureAId);
    animalId = animal.id;
  });

  it('rejects duplicate ear tag within the same farm', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ earTag: 'BR-0001', sex: 'MALE', category: 'BOI' })
      .expect(409);
  });

  it('rejects a pasture from a different farm', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        earTag: 'BR-9999',
        sex: 'MALE',
        category: 'BOI',
        pastureId: 'non-existent',
      })
      .expect(400);
  });

  it('lists animals for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      (res.body as AnimalResponseBody[]).some((a) => a.id === animalId),
    ).toBe(true);
  });

  it('transfers the animal to a different pasture and logs history', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${animalId}/transferir`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ pastureId: pastureBId })
      .expect(201);

    expect((res.body as AnimalResponseBody).pastureId).toBe(pastureBId);

    const historyRes = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/animais/${animalId}/historico`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const events = historyRes.body as AnimalEventResponseBody[];
    expect(events.some((e) => e.type === 'TRANSFER')).toBe(true);
  });

  it('transfers the animal to a different property', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/animais/${animalId}/transferir`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetFarmId: secondFarmId })
      .expect(201);

    const animal = res.body as AnimalResponseBody;
    expect(animal.farmId).toBe(secondFarmId);
    expect(animal.pastureId).toBeNull();
  });

  it('soft-deletes (sells/removes) an animal', async () => {
    await request(app.getHttpServer())
      .delete(`/fazendas/${secondFarmId}/animais/${animalId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/fazendas/${secondFarmId}/animais`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      (res.body as AnimalResponseBody[]).some((a) => a.id === animalId),
    ).toBe(false);
  });
});
