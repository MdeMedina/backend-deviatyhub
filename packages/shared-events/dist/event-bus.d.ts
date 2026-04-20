import { RedisOptions } from 'ioredis';
/**
 * Bus de Eventos basado en Redis Pub/Sub.
 * Esta clase maneja la serialización automática de payloads y la gestión de suscripciones.
 */
export declare class EventBus {
    private publisher;
    private subscriber;
    constructor(options: RedisOptions);
    /**
     * Publica un evento en un canal específico
     * @param channel Nombre del canal (usar REDIS_CHANNELS)
     * @param payload Datos del evento
     */
    publish<T>(channel: string, payload: T): Promise<void>;
    /**
     * Guarda un valor con tiempo de expiración (para blacklist, etc)
     */
    setKey(key: string, value: string, ttlSeconds: number): Promise<void>;
    /**
     * Recupera un valor por su llave
     */
    getKey(key: string): Promise<string | null>;
    /**
     * Se suscribe a un canal y ejecuta un handler por cada mensaje recibido
     * @param channel Nombre del canal
     * @param handler Función para procesar el payload del evento
     */
    subscribe<T>(channel: string, handler: (payload: T) => void | Promise<void>): Promise<void>;
    /**
     * Cierra las conexiones de Redis
     */
    disconnect(): Promise<void>;
}
//# sourceMappingURL=event-bus.d.ts.map