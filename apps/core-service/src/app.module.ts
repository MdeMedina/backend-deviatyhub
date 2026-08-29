import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import {
  ApiResponseInterceptor,
  HttpExceptionFilter,
  AuditInterceptor,
} from '@deviaty/shared-nestjs';
import { SharedEventsModule } from '@deviaty/shared-events';
import { PrismaModule } from './prisma/prisma.module';
import { ClinicModule } from './clinic/clinic.module';
import { DoctorModule } from './doctor/doctor.module';
import { TreatmentModule } from './treatment/treatment.module';
import { AgendaModule } from './agenda/agenda.module';
import { ConversationModule } from './conversation/conversation.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }) as any,
    SharedEventsModule,
    PrismaModule,
    ClinicModule,
    DoctorModule,
    TreatmentModule,
    AgendaModule,
    ConversationModule,
    MetricsModule,
  ],
  controllers: [],
  providers: [
    Reflector,
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
