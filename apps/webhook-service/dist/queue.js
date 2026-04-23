"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageQueue = void 0;
exports.enqueueMessage = enqueueMessage;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connection = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Requerido por BullMQ
});
// Cola para procesar mensajes entrantes
exports.messageQueue = new bullmq_1.Queue('messages', {
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
async function enqueueMessage(channel, payload) {
    await exports.messageQueue.add('process_webhook', {
        channel,
        payload,
        receivedAt: new Date().toISOString(),
    });
}
//# sourceMappingURL=queue.js.map