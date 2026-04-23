import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedEventsModule } from '@deviaty/shared-events';
import { SharedPrismaModule } from '@deviaty/shared-prisma';
import { WhatsAppSenderService } from './whatsapp.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedEventsModule,
    SharedPrismaModule,
  ],
  providers: [WhatsAppSenderService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  // El servicio se inicializará automáticamente por OnModuleInit al instanciarse
  app.get(WhatsAppSenderService); 
  console.log('--- WHATSAPP SENDER SERVICE RUNNING ---');
}

bootstrap();
