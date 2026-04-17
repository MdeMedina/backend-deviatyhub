import { Redis, RedisOptions } from 'ioredis';

/**
 * Bus de Eventos basado en Redis Pub/Sub.
 * Esta clase maneja la serialización automática de payloads y la gestión de suscripciones.
 */
export class EventBus {
  private publisher: Redis;
  private subscriber: Redis;

  constructor(options: RedisOptions) {
    this.publisher = new Redis(options);
    this.subscriber = new Redis(options);
    
    this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
  }

  /**
   * Publica un evento en un canal específico
   * @param channel Nombre del canal (usar REDIS_CHANNELS)
   * @param payload Datos del evento
   */
  async publish<T>(channel: string, payload: T): Promise<void> {
    const message = JSON.stringify({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      channel,
      payload
    });
    
    await this.publisher.publish(channel, message);
  }

  /**
   * Se suscribe a un canal y ejecuta un handler por cada mensaje recibido
   * @param channel Nombre del canal
   * @param handler Función para procesar el payload del evento
   */
  async subscribe<T>(channel: string, handler: (payload: T) => void | Promise<void>): Promise<void> {
    await this.subscriber.subscribe(channel);
    
    this.subscriber.on('message', async (chan, message) => {
      if (chan === channel) {
        try {
          const event = JSON.parse(message);
          await handler(event.payload);
        } catch (error) {
          console.error(`Error procesando mensaje en canal ${channel}:`, error);
        }
      }
    });
  }

  /**
   * Cierra las conexiones de Redis
   */
  async disconnect(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
