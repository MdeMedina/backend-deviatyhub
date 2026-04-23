"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const fastify_raw_body_1 = __importDefault(require("fastify-raw-body"));
const dotenv_1 = __importDefault(require("dotenv"));
const validator_1 = require("./validator");
const queue_1 = require("./queue");
dotenv_1.default.config();
const server = (0, fastify_1.default)({
    logger: true,
});
// Registrar plugin para obtener el body crudo (necesario para HMAC)
server.register(fastify_raw_body_1.default, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
});
const PORT = parseInt(process.env.PORT || '3005');
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'deviaty_secret_token';
const APP_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || '';
/**
 * Endpoint de verificación de Meta (GET)
 */
server.get('/webhook/whatsapp', async (request, reply) => {
    const query = request.query;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        server.log.info('Webhook verificado exitosamente.');
        return reply.status(200).send(challenge);
    }
    server.log.warn('Falla en verificación de webhook: Token inválido.');
    return reply.status(403).send('Forbidden');
});
/**
 * Endpoint de recepción de eventos (POST)
 */
server.post('/webhook/whatsapp', { config: { rawBody: true } }, async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'];
    const body = request.rawBody;
    // 1. Validar Firma HMAC
    if (!(0, validator_1.validateMetaSignature)(body, signature, APP_SECRET)) {
        server.log.error('Firma de webhook inválida.');
        return reply.status(401).send('Invalid signature');
    }
    // 2. Procesar Payload
    try {
        const payload = JSON.parse(body);
        server.log.info('Mensaje recibido, encolando...');
        await (0, queue_1.enqueueMessage)('whatsapp', payload);
        return reply.status(200).send('EVENT_RECEIVED');
    }
    catch (error) {
        server.log.error(`Error procesando webhook: ${error.message}`);
        return reply.status(400).send('Bad Request');
    }
});
// Health check
server.get('/health', async () => {
    return { status: 'ok', service: 'webhook-service' };
});
const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 Webhook Service corriendo en puerto ${PORT}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=main.js.map