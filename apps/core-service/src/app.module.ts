import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import {
  ApiResponseInterceptor,
  HttpExceptionFilter,
  AuditInterceptor,
} from '@deviaty/shared-nestjs';
import { PrismaModule } from './prisma/prisma.module';
import { ClinicModule } from './clinic/clinic.module';
import { DoctorModule } from './doctor/doctor.module';
import { TreatmentModule } from './treatment/treatment.module';
import { AgendaModule } from './agenda/agenda.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ClinicModule,
    DoctorModule,
    TreatmentModule,
    AgendaModule,
  ],
  controllers: [],
  providers: [
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
