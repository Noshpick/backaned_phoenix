// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl =
    process.env.FRONTEND_URL?.trim() || 'https://firephoenix.school';

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? frontendUrl : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'X-API-KEY',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ВАЖНО: если включишь global prefix, то контроллер BotHttpController
  // должен быть @Controller('bot'), а не @Controller('/api/bot')
  // app.setGlobalPrefix('api');

  await app.listen(Number(process.env.PORT) || 3000);
}

bootstrap();