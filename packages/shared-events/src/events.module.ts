import { Module, Global } from '@nestjs/common';
import { EventBus } from './event-bus';

export const EVENT_BUS_TOKEN = 'EVENT_BUS';

@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS_TOKEN,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        try {
          const url = new URL(redisUrl);
          return new EventBus({
            host: url.hostname || 'localhost',
            port: parseInt(url.port) || 6379,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
            maxRetriesPerRequest: null,
            lazyConnect: false,
          });
        } catch {
          return new EventBus({
            host: 'localhost',
            port: 6379,
            maxRetriesPerRequest: null,
            lazyConnect: false,
          });
        }
      },
    },
    {
      provide: EventBus,
      useExisting: EVENT_BUS_TOKEN,
    },
  ],
  exports: [EVENT_BUS_TOKEN, EventBus],
})
export class SharedEventsModule {}
