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

interface MachineResponseBody {
  id: string;
  currentHourMeter: number;
}

interface CostSummaryBody {
  machineId: string;
  maintenanceCost: number;
  fuelCost: number;
  totalCost: number;
  totalLiters: number;
}

describe('Machines (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `machines-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };

  let ownerToken: string;
  let farmId: string;
  let machineId: string;

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
      .send({ name: 'Fazenda Maquinas Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;
  });

  afterAll(async () => {
    await prisma.machineMaintenance.deleteMany({
      where: { machine: { farmId } },
    });
    await prisma.machineFuelRecord.deleteMany({
      where: { machine: { farmId } },
    });
    await prisma.machine.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { email: owner.email } });
    await app.close();
  });

  it('creates a machine', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/maquinas`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Trator Massey',
        type: 'TRATOR',
        brand: 'Massey Ferguson',
        year: 2020,
      })
      .expect(201);

    const machine = res.body as MachineResponseBody;
    expect(machine.currentHourMeter).toBe(0);
    machineId = machine.id;
  });

  it('records a fuel entry and advances the hour meter', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ liters: 50, cost: 350, hourMeterAt: 120 })
      .expect(201);

    expect(res.body).toBeDefined();

    const machineRes = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/maquinas/${machineId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect((machineRes.body as MachineResponseBody).currentHourMeter).toBe(120);
  });

  it('records a maintenance and does not regress the hour meter with a lower reading', async () => {
    await request(app.getHttpServer())
      .post(`/fazendas/${farmId}/maquinas/${machineId}/manutencoes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'Troca de óleo', cost: 200, hourMeterAt: 100 })
      .expect(201);

    const machineRes = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/maquinas/${machineId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    // hour meter stays at 120 (the higher reading), not regressed to 100
    expect((machineRes.body as MachineResponseBody).currentHourMeter).toBe(120);
  });

  it('aggregates maintenance and fuel costs for the machine', async () => {
    const res = await request(app.getHttpServer())
      .get(`/fazendas/${farmId}/maquinas/custos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const summary = (res.body as CostSummaryBody[]).find(
      (s) => s.machineId === machineId,
    )!;
    expect(summary.fuelCost).toBe(350);
    expect(summary.maintenanceCost).toBe(200);
    expect(summary.totalCost).toBe(550);
    expect(summary.totalLiters).toBe(50);
  });

  describe('editing and deleting maintenance/fuel records', () => {
    let maintenanceId: string;
    let fuelRecordId: string;

    it('lets the owner edit a maintenance record, recomputing the hour meter', async () => {
      const machineRes = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/maquinas/${machineId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      maintenanceId = (machineRes.body as { maintenances: { id: string }[] })
        .maintenances[0].id;

      const res = await request(app.getHttpServer())
        .patch(
          `/fazendas/${farmId}/maquinas/${machineId}/manutencoes/${maintenanceId}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ cost: 250, hourMeterAt: 150 })
        .expect(200);

      expect((res.body as { cost: number }).cost).toBe(250);

      const updatedMachine = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/maquinas/${machineId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      // 150 (edited maintenance) is now higher than 120 (fuel)
      expect(
        (updatedMachine.body as MachineResponseBody).currentHourMeter,
      ).toBe(150);
    });

    it('lets the owner delete a maintenance record, recomputing the hour meter back down', async () => {
      await request(app.getHttpServer())
        .delete(
          `/fazendas/${farmId}/maquinas/${machineId}/manutencoes/${maintenanceId}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const updatedMachine = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/maquinas/${machineId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      // back to 120, the remaining fuel record's reading
      expect(
        (updatedMachine.body as MachineResponseBody).currentHourMeter,
      ).toBe(120);
    });

    it('lets the owner edit a fuel record', async () => {
      const machineRes = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/maquinas/${machineId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      fuelRecordId = (machineRes.body as { fuelRecords: { id: string }[] })
        .fuelRecords[0].id;

      const res = await request(app.getHttpServer())
        .patch(
          `/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel/${fuelRecordId}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ liters: 60, cost: 420 })
        .expect(200);

      expect((res.body as { liters: number }).liters).toBe(60);
    });

    it('lets the owner delete a fuel record, recomputing the hour meter to 0', async () => {
      await request(app.getHttpServer())
        .delete(
          `/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel/${fuelRecordId}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const updatedMachine = await request(app.getHttpServer())
        .get(`/fazendas/${farmId}/maquinas/${machineId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(
        (updatedMachine.body as MachineResponseBody).currentHourMeter,
      ).toBe(0);
    });
  });
});
