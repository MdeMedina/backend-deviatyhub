import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@deviaty/shared-events';

@Global()
@Module({
  providers: [
    {
      provide: 'EVENT_BUS',
      useFactory: (config: ConfigService) => {
        return new EventBus({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['EVENT_BUS'],
})
export class EventsModule {}
