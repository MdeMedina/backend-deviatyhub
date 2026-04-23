import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { EmailService } from './email/email.service';
import { NotificationListener } from './listeners/notification.listener';
import { EventBus } from '@deviaty/shared-events';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('GMAIL_HOST', 'smtp.gmail.com'),
          port: config.get('GMAIL_PORT', 587),
          auth: {
            user: config.get('GMAIL_USER'),
            pass: config.get('GMAIL_PASS'),
          },
        },
        defaults: {
          from: `"Deviaty Hub" <${config.get('GMAIL_USER', 'no-reply@deviaty.com')}>`,
        },
        template: {
          dir: join(__dirname, 'email', 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [HealthController],
  providers: [
    EmailService,
    NotificationListener,
    {
      provide: EventBus,
      useFactory: (config: ConfigService) => {
        return new EventBus({
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
