import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Requerido por BullMQ
});

// Cola para procesar mensajes entrantes
export const messageQueue = new Queue('messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

/**
 * Encola un payload de webhook para procesamiento posterior
 * @param channel Canal de origen ('whatsapp' | 'instagram')
 * @param payload El JSON crudo recibido del webhook
 */
export async function enqueueMessage(channel: string, payload: any) {
  await messageQueue.add('process_webhook', {
    channel,
    payload,
    receivedAt: new Date().toISOString(),
  });
}
