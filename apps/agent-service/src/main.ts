import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const logger = new Logger('Bootstrap');
  logger.log('🤖 Agent Service (AmalIA) worker started and listening to "messages" queue');
  
  // Mantener el proceso vivo para el worker de BullMQ
  // No necesitamos un servidor HTTP público (Gateway rutea pero este es un worker)
}

bootstrap();
