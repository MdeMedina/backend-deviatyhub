import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { BrainModule } from './brain/brain.module';
import { WorkerModule } from './worker/worker.module';
import { Reflector, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import {
  AuditInterceptor,
  ApiResponseInterceptor,
  HttpExceptionFilter,
} from '@deviaty/shared-nestjs';
import { AgentController } from './agent.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL', 'redis://localhost:6379');
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname || 'localhost',
            port: parseInt(url.port) || 6379,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'messages',
    }),
    PrismaModule,
    BrainModule,
    WorkerModule,
  ],
  controllers: [AgentController],
  providers: [
    Reflector,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
