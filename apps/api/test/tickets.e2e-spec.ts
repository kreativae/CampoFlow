import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface TicketBody {
  id: string;
  subject: string;
  status: string;
  messages: { message: string; fromStaff: boolean }[];
}

describe('Tickets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const admin = {
    email: `ticket-admin-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Ticket Admin',
  };
  const customer = {
    email: `ticket-customer-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Ticket Customer',
  };
  const otherCustomer = {
    email: `ticket-other-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Other Customer',
  };

  let adminToken: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let ticketId: string;

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_EMAILS = admin.email;

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

    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(admin);
    adminToken = (adminRes.body as AuthResponseBody).accessToken;

    const customerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(customer);
    customerToken = (customerRes.body as AuthResponseBody).accessToken;

    const otherRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(otherCustomer);
    otherCustomerToken = (otherRes.body as AuthResponseBody).accessToken;
  });

  afterAll(async () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    const dbUsers = await prisma.user.findMany({
      where: {
        email: { in: [admin.email, customer.email, otherCustomer.email] },
      },
    });
    const accountIds = dbUsers.map((u) => u.accountId);
    // Clear tickets/messages across all involved accounts up front — a staff
    // reply is authored by the admin but lives on the customer's ticket, so
    // deleting users one account at a time (in array order) would hit the
    // TicketMessage_authorId_fkey before the message itself is gone.
    await prisma.ticketMessage.deleteMany({
      where: { ticket: { accountId: { in: accountIds } } },
    });
    await prisma.ticket.deleteMany({
      where: { accountId: { in: accountIds } },
    });

    for (const email of [admin.email, customer.email, otherCustomer.email]) {
      const dbUser = await prisma.user.findUnique({ where: { email } });
      if (dbUser) {
        await prisma.membership.deleteMany({ where: { userId: dbUser.id } });
        await prisma.farm.deleteMany({
          where: { accountId: dbUser.accountId },
        });
        await prisma.subscription.deleteMany({
          where: { accountId: dbUser.accountId },
        });
        await prisma.user.delete({ where: { id: dbUser.id } });
        await prisma.account.delete({ where: { id: dbUser.accountId } });
      }
    }
    await app.close();
  });

  it('lets a customer create a ticket with an initial message', async () => {
    const res = await request(app.getHttpServer())
      .post('/suporte')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        subject: 'Problema na cobrança',
        message: 'Fui cobrado duas vezes.',
      })
      .expect(201);

    const body = res.body as TicketBody;
    expect(body.subject).toBe('Problema na cobrança');
    expect(body.status).toBe('ABERTO');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].fromStaff).toBe(false);
    ticketId = body.id;
  });

  it("lists tickets only for the caller's own account", async () => {
    const res = await request(app.getHttpServer())
      .get('/suporte')
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(200);
    expect(res.body as TicketBody[]).toHaveLength(0);
  });

  it('blocks a regular user from the admin tickets endpoint', async () => {
    await request(app.getHttpServer())
      .get('/admin/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('lets a platform admin see tickets across all accounts', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const tickets = res.body as TicketBody[];
    expect(tickets.some((t) => t.id === ticketId)).toBe(true);
  });

  it('lets a platform admin reply, which marks the ticket EM_ANDAMENTO', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/tickets/${ticketId}/mensagens`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Vamos verificar e te retornamos em breve.' })
      .expect(201);

    const body = res.body as TicketBody;
    expect(body.status).toBe('EM_ANDAMENTO');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].fromStaff).toBe(true);
  });

  it('lets the customer see the staff reply and respond back', async () => {
    const res = await request(app.getHttpServer())
      .post(`/suporte/${ticketId}/mensagens`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ message: 'Obrigado, aguardo o retorno.' })
      .expect(201);

    const body = res.body as TicketBody;
    expect(body.messages).toHaveLength(3);
  });

  it("blocks a customer from another account from reading someone else's ticket", async () => {
    await request(app.getHttpServer())
      .get(`/suporte/${ticketId}`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(404);
  });

  it('lets a platform admin close the ticket', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'FECHADO' })
      .expect(200);

    expect((res.body as TicketBody).status).toBe('FECHADO');
  });
});
