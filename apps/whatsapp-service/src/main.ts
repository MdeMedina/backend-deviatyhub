import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { EventBus } from '@deviaty/shared-events';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Crear EventBus directamente
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let eventBusOptions: any = { host: 'localhost', port: 6379, maxRetriesPerRequest: null };

try {
  const url = new URL(redisUrl);
  eventBusOptions = {
    host: url.hostname || 'localhost',
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
} catch {}

const eventBus = new EventBus(eventBusOptions);

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

async function sendToMeta(event: any) {
  const { recipient, content, conversationId, clinicId } = event;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn('⚠️ WHATSAPP credentials missing. Skipping delivery.');
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { body: content },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Mensaje enviado a ${recipient}`);
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ Error enviando a ${recipient}: ${errorMsg}`);
  }
}

async function bootstrap() {
  await prisma.$connect();
  console.log('✅ Prisma conectado.');

  await eventBus.subscribe('message.outbound', async (payload: any) => {
    await sendToMeta(payload);
  });

  console.log('🚀 WhatsApp Sender Service corriendo. Escuchando message.outbound...');
}

bootstrap().catch((err) => {
  console.error('❌ Error iniciando WhatsApp Service:', err);
  process.exit(1);
});
