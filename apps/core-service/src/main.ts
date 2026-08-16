import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await (NestFactory.create as any)(
    AppModule,
    new FastifyAdapter(),
  ) as NestFastifyApplication;

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

  // Hook para evitar error 400 de Fastify cuando viene Content-Type pero el body está vacío (ej. en peticiones DELETE/GET)
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', (request: any, reply: any, done: any) => {
    const method = request.raw.method;
    const contentType = request.headers['content-type'];
    const contentLength = request.headers['content-length'];

    if (contentType && (contentLength === '0' || !contentLength || method === 'DELETE' || method === 'GET')) {
      delete request.headers['content-type'];
    }
    done();
  });

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');

  console.log(`🏥 Core Service is running on: http://localhost:${port}`);
}

bootstrap();
