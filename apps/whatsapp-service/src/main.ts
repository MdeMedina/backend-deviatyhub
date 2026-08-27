import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { EventBus } from '@deviaty/shared-events';
import { PrismaClient } from '@deviaty/shared-prisma';
import { decryptAES256 } from '@deviaty/shared-utils';
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

  let phoneNumberId = PHONE_NUMBER_ID;
  let accessToken = ACCESS_TOKEN;

  if (clinicId) {
    try {
      const integration = await prisma.clinicIntegration.findFirst({
        where: {
          clinicId,
          type: 'WHATSAPP',
        },
      });

      if (integration && integration.credentials) {
        const credsObj = integration.credentials as any;
        if (credsObj.encrypted_data) {
          const secretKey = process.env.JWT_ACCESS_SECRET;
          if (!secretKey) throw new Error('JWT_ACCESS_SECRET no está configurado');
          const decrypted = decryptAES256(credsObj.encrypted_data, secretKey);
          const credentials = JSON.parse(decrypted);

          if (credentials.phone_number_id) {
            phoneNumberId = credentials.phone_number_id;
          }
          if (credentials.access_token) {
            accessToken = credentials.access_token;
          }
        }
      }
    } catch (dbError: any) {
      console.error(`⚠️ Error consultando BDD para cargar credenciales de WhatsApp: ${dbError.message}`);
    }
  }

  if (!phoneNumberId || !accessToken) {
    console.warn(`⚠️ WHATSAPP credentials missing for clinic ${clinicId}. Skipping delivery.`);
    try {
      await prisma.message.create({
        data: {
          conversationId,
          clinicId,
          role: 'SYSTEM',
          content: 'Error de entrega: Credenciales de WhatsApp no configuradas.',
          sentAt: new Date(),
        },
      });
    } catch {}
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { body: content },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Mensaje enviado a ${recipient}`);
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ Error enviando a ${recipient}: ${errorMsg}`);
    try {
      await prisma.message.create({
        data: {
          conversationId,
          clinicId,
          role: 'SYSTEM',
          content: `Error de entrega: ${errorMsg}`,
          sentAt: new Date(),
        },
      });
    } catch {}
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
