import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import helmet from 'helmet';

// Сетевые сбои внешних сервисов (Discord/Telegram под ТСПУ) не должны ронять бэкенд.
// Без этого одна непойманная promise-ошибка (ConnectTimeout) крашит процесс в цикле.
process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection]', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('[uncaughtException]', err?.message || err);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // don't break existing endpoints
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`CONDR Faceit backend running on port ${port}`);
}

bootstrap();
