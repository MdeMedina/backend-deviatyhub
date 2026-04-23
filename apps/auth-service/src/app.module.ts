import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import {
  ApiResponseInterceptor,
  AuditInterceptor,
  HttpExceptionFilter,
} from '@deviaty/shared-nestjs';
import { APP_INTERCEPTOR, APP_FILTER, Reflector } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    RolesModule,
    UsersModule,
    EventsModule,
  ],
  controllers: [],
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
