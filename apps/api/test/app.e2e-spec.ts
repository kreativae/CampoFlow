import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) retorna as informações da API', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.body).toMatchObject({
      name: 'CampoFlow API',
      status: 'ok',
      docs: '/docs',
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(typeof res.body.version).toBe('string');
  });

  afterEach(async () => {
    await app.close();
  });
});
