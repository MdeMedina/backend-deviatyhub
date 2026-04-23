import fastify from 'fastify';
import rawBody from 'fastify-raw-body';
import dotenv from 'dotenv';
import { validateMetaSignature } from './validator';
import { enqueueMessage } from './queue';

dotenv.config();

const server = fastify({
  logger: true,
});

// Registrar plugin para obtener el body crudo (necesario para HMAC)
server.register(rawBody, {
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
  const query = request.query as any;
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
  const signature = request.headers['x-hub-signature-256'] as string;
  const body = (request as any).rawBody;

  // 1. Validar Firma HMAC
  if (!validateMetaSignature(body, signature, APP_SECRET)) {
    server.log.error('Firma de webhook inválida.');
    return reply.status(401).send('Invalid signature');
  }

  // 2. Procesar Payload
  try {
    const payload = JSON.parse(body);
    server.log.info('Mensaje recibido, encolando...');
    
    await enqueueMessage('whatsapp', payload);
    
    return reply.status(200).send('EVENT_RECEIVED');
  } catch (error: any) {
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
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
