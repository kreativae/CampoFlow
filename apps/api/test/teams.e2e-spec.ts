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

interface UserResponseBody {
  user: { id: string };
}

interface TaskResponseBody {
  id: string;
  status: string;
  assignedToId: string | null;
}

interface WorkLogResponseBody {
  id: string;
  hoursWorked: number;
}

interface ShiftResponseBody {
  id: string;
}

describe('Teams (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const owner = {
    email: `teams-owner-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Owner',
  };
  const employee = {
    email: `teams-employee-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Employee',
  };

  let ownerToken: string;
  let employeeToken: string;
  let employeeId: string;
  let farmId: string;
  let taskId: string;

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
    employeeId = (employeeRes.body as UserResponseBody).user.id;

    const farmRes = await request(app.getHttpServer())
      .post('/farms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fazenda Equipes Teste' });
    farmId = (farmRes.body as FarmResponseBody).id;

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: employee.email, role: 'EMPLOYEE' });
  });

  afterAll(async () => {
    await prisma.workLog.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
    await prisma.shift.deleteMany({ where: { farmId } });
    await prisma.membership.deleteMany({ where: { farmId } });
    await prisma.farm.delete({ where: { id: farmId } });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, employee.email] } },
    });
    await app.close();
  });

  it('creates a task assigned to a farm member', async () => {
    const res = await request(app.getHttpServer())
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Reparar cerca do pasto 3', assignedToId: employeeId })
      .expect(201);

    const task = res.body as TaskResponseBody;
    expect(task.status).toBe('PENDENTE');
    expect(task.assignedToId).toBe(employeeId);
    taskId = task.id;
  });

  it('rejects assigning a task to a non-member user', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Outra tarefa', assignedToId: 'non-existent-user-id' })
      .expect(400);
  });

  it('rejects a non-privileged role from creating a task', async () => {
    await request(app.getHttpServer())
      .post(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Tarefa indevida' })
      .expect(403);
  });

  it('allows the assigned employee to update the task status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/farms/${farmId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'CONCLUIDA' })
      .expect(200);

    expect((res.body as TaskResponseBody).status).toBe('CONCLUIDA');
  });

  it('lists tasks for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as TaskResponseBody[]).some((t) => t.id === taskId)).toBe(
      true,
    );
  });

  it('lets the employee log hours worked against the task', async () => {
    const res = await request(app.getHttpServer())
      .post(`/farms/${farmId}/work-logs`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ description: 'Conserto da cerca', hoursWorked: 3.5, taskId })
      .expect(201);

    expect((res.body as WorkLogResponseBody).hoursWorked).toBe(3.5);
  });

  it('lists work logs for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/work-logs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as WorkLogResponseBody[]).length).toBe(1);
  });

  it('creates a shift (escala) for a farm member', async () => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);

    const res = await request(app.getHttpServer())
      .post(`/farms/${farmId}/shifts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        userId: employeeId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      .expect(201);

    expect((res.body as ShiftResponseBody).id).toBeDefined();
  });

  it('rejects a non-privileged role from creating a shift', async () => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 1);

    await request(app.getHttpServer())
      .post(`/farms/${farmId}/shifts`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        userId: employeeId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      .expect(403);
  });

  it('lists shifts for the farm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/farms/${farmId}/shifts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((res.body as ShiftResponseBody[]).length).toBe(1);
  });
});
