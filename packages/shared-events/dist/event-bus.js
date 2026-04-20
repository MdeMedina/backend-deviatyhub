"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
const ioredis_1 = require("ioredis");
/**
 * Bus de Eventos basado en Redis Pub/Sub.
 * Esta clase maneja la serialización automática de payloads y la gestión de suscripciones.
 */
class EventBus {
    publisher;
    subscriber;
    constructor(options) {
        this.publisher = new ioredis_1.Redis(options);
        this.subscriber = new ioredis_1.Redis(options);
        this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
        this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    }
    /**
     * Publica un evento en un canal específico
     * @param channel Nombre del canal (usar REDIS_CHANNELS)
     * @param payload Datos del evento
     */
    async publish(channel, payload) {
        const message = JSON.stringify({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            channel,
            payload
        });
        await this.publisher.publish(channel, message);
    }
    /**
     * Guarda un valor con tiempo de expiración (para blacklist, etc)
     */
    async setKey(key, value, ttlSeconds) {
        await this.publisher.setex(key, ttlSeconds, value);
    }
    /**
     * Recupera un valor por su llave
     */
    async getKey(key) {
        return this.publisher.get(key);
    }
    /**
     * Se suscribe a un canal y ejecuta un handler por cada mensaje recibido
     * @param channel Nombre del canal
     * @param handler Función para procesar el payload del evento
     */
    async subscribe(channel, handler) {
        await this.subscriber.subscribe(channel);
        this.subscriber.on('message', async (chan, message) => {
            if (chan === channel) {
                try {
                    const event = JSON.parse(message);
                    await handler(event.payload);
                }
                catch (error) {
                    console.error(`Error procesando mensaje en canal ${channel}:`, error);
                }
            }
        });
    }
    /**
     * Cierra las conexiones de Redis
     */
    async disconnect() {
        await this.publisher.quit();
        await this.subscriber.quit();
    }
}
exports.EventBus = EventBus;
//# sourceMappingURL=event-bus.js.map