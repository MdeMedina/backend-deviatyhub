import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await (NestFactory.create as any)(
    AppModule,
    new FastifyAdapter(),
  ) as NestFastifyApplication;

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 400,
    }),
  );

  const logger = new Logger('Bootstrap');
  const port = process.env.PORT || 3003;
  await app.listen(port, '0.0.0.0');

  logger.log(`🤖 Agent Service (AmalIA) HTTP server is running on: http://localhost:${port}`);
}

bootstrap();
