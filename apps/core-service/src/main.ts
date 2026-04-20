import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Prefijo global /api tal como exige API Reference desde el Gateway
  // Nota: Aunque el Gateway lo añade, los microservicios deben ser consistentes
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 400,
    }),
  );

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');

  console.log(`🏥 Core Service is running on: http://localhost:${port}`);
}

bootstrap();
