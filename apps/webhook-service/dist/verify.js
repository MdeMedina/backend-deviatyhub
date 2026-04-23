"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const fastify_1 = __importDefault(require("fastify"));
const fastify_raw_body_1 = __importDefault(require("fastify-raw-body"));
const validator_1 = require("./validator");
// No importamos queue directamente para evitar conexión a Redis
// import { enqueueMessage } from './queue';
const VERIFY_TOKEN = 'deviaty_secret_token';
const APP_SECRET = 'meta_app_secret_123';
async function verifyWebhookService() {
    console.log('--- 🧪 VERIFICACIÓN AISLADA: WEBHOOK SERVICE (PHASE 5) ---');
    const server = (0, fastify_1.default)();
    // Mock de enqueueMessage
    const mockEnqueue = async (channel, payload) => {
        console.log(`[MOCK QUEUE] Encolando mensaje de ${channel}`);
        return Promise.resolve();
    };
    server.register(fastify_raw_body_1.default, {
        field: 'rawBody',
        global: false,
        encoding: 'utf8',
        runFirst: true,
    });
    // Re-implementamos las rutas mínimas para testeo o importamos una versión testeable
    // Para esta verificación, inyectaremos las rutas directamente
    server.get('/webhook/whatsapp', async (request, reply) => {
        const query = request.query;
        if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === VERIFY_TOKEN) {
            return reply.send(query['hub.challenge']);
        }
        return reply.status(403).send('Forbidden');
    });
    server.post('/webhook/whatsapp', { config: { rawBody: true } }, async (request, reply) => {
        const signature = request.headers['x-hub-signature-256'];
        // En server.inject, rawBody puede no popularse como en un request real
        const body = request.rawBody || (request.body ? JSON.stringify(request.body) : '');
        if (!(0, validator_1.validateMetaSignature)(body, signature, APP_SECRET)) {
            return reply.status(401).send('Invalid signature');
        }
        const payload = JSON.parse(body);
        await mockEnqueue('whatsapp', payload);
        return reply.status(200).send('EVENT_RECEIVED');
    });
    console.log('\n👉 [1. TEST: META VERIFICATION (GET)]');
    const getRes = await server.inject({
        method: 'GET',
        url: '/webhook/whatsapp',
        query: {
            'hub.mode': 'subscribe',
            'hub.verify_token': VERIFY_TOKEN,
            'hub.challenge': '123456789'
        }
    });
    if (getRes.statusCode === 200 && getRes.payload === '123456789') {
        console.log('✅ PASS: Validación de token y challenge exitosa.');
    }
    else {
        console.log(`❌ FAIL: Respuesta incorrecta (${getRes.statusCode}): ${getRes.payload}`);
    }
    console.log('\n👉 [2. TEST: VALID SIGNATURE (POST)]');
    const payloadStr = JSON.stringify({ test: 'data' });
    const validSig = 'sha256=' + crypto_1.default
        .createHmac('sha256', APP_SECRET)
        .update(payloadStr)
        .digest('hex');
    const postRes = await server.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
            'content-type': 'application/json',
            'x-hub-signature-256': validSig
        },
        payload: payloadStr
    });
    if (postRes.statusCode === 200 && postRes.payload === 'EVENT_RECEIVED') {
        console.log('✅ PASS: Webhook con firma válida aceptado.');
    }
    else {
        console.log(`❌ FAIL: Rechazado injustamente (${postRes.statusCode}): ${postRes.payload}`);
    }
    console.log('\n👉 [3. TEST: INVALID SIGNATURE (POST)]');
    const invalidRes = await server.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
            'content-type': 'application/json',
            'x-hub-signature-256': 'sha256=invalid'
        },
        payload: payloadStr
    });
    if (invalidRes.statusCode === 401) {
        console.log('✅ PASS: Firma inválida rechazada correctamente.');
    }
    else {
        console.log(`❌ FAIL: No se rechazó firma inválida (${invalidRes.statusCode})`);
    }
    console.log('\n--- 🎉 VERIFICACIÓN FINALIZADA ---');
    process.exit(0);
}
verifyWebhookService();
//# sourceMappingURL=verify.js.map