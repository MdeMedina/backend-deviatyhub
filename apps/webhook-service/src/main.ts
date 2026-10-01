import fastify from 'fastify';
import dotenv from 'dotenv';
import { validateMetaSignature } from './validator';
import { enqueueMessage } from './queue';

dotenv.config();

const server = fastify({
  logger: true,
});

// Capturar el body CRUDO (necesario para validar la firma HMAC de Meta) y
// además parsear el JSON. Reemplaza a fastify-raw-body, que no poblaba rawBody.
server.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body, done) => {
    (req as any).rawBody = body;
    try {
      const json = body && (body as string).length ? JSON.parse(body as string) : {};
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);

const PORT = parseInt(process.env.PORT || '3005');
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'deviaty_secret_token';
const APP_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || '';

/**
 * Meta puede agrupar en un mismo webhook varios mensajes, y de números
 * distintos (cada `entry` es una cuenta, cada `change` un número). El agente
 * procesa un mensaje por trabajo y decide la clínica por el número de destino,
 * así que aquí se reparte: un payload por mensaje, con su propio `metadata`.
 * Los avisos de estado (entregado, leído) no traen mensajes y no se encolan;
 * el agente ya los descartaba.
 */
function separarPorMensaje(payload: any): any[] {
  const salida: any[] = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      for (const message of value?.messages || []) {
        salida.push({
          ...payload,
          entry: [{ ...entry, changes: [{ ...change, value: { ...value, messages: [message] } }] }],
        });
      }
    }
  }
  return salida;
}

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
    const mensajes = separarPorMensaje(payload);
    server.log.info(`Webhook con ${mensajes.length} mensaje(s), encolando...`);

    for (const unMensaje of mensajes) {
      await enqueueMessage('whatsapp', unMensaje);
    }
    
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
