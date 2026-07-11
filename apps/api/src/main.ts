// Must be imported before anything else so Sentry can instrument every other
// module as it loads (see src/instrument.ts for why and the SENTRY_DSN gate).
import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JsonLogger } from './common/logging/json-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
    rawBody: true,
  });

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CampoFlow API')
    .setDescription(
      'API do CampoFlow: gestão de propriedades, rebanho, sanidade, reprodução e financeiro.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
