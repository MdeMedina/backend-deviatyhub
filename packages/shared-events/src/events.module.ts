import { Module, Global, DynamicModule } from '@nestjs/common';
import { EventBus } from './event-bus';

@Global()
@Module({
  providers: [
    {
      provide: EventBus,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        // Extraer opciones simples de la URL si es necesario, o pasar la URL directamente si el constructor de subagent lo soporta
        return new EventBus({ host: 'localhost', port: 6379 }); // Ajustar según necesidad real
      },
    },
  ],
  exports: [EventBus],
})
export class SharedEventsModule {}
