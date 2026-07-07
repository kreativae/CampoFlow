import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns API info with name and docs path', () => {
      const info = appController.getInfo();
      expect(info.name).toBe('CampoFlow API');
      expect(info.status).toBe('ok');
      expect(info.docs).toBe('/docs');
    });
  });
});
