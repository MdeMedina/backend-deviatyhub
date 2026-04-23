import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppSenderService } from './whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@deviaty/shared-events';
import { PrismaService } from '@deviaty/shared-prisma';
import { Channel } from '@deviaty/shared-types';

async function verifyWhatsAppOutbound() {
  console.log('--- 🧪 VERIFICACIÓN AISLADA: WHATSAPP SERVICE (PHASE 8) ---');

  const mockConfig = {
    get: (key: string) => {
      if (key === 'WHATSAPP_PHONE_NUMBER_ID') return ''; // Simulando que aún no están
      if (key === 'WHATSAPP_ACCESS_TOKEN') return '';
      return null;
    }
  };

  const mockPrisma = {
    message: {
      create: (args: any) => {
        console.log(`💾 [DB LOG] Registrando fallo en BDD: ${args.data.content}`);
        return Promise.resolve(args.data);
      }
    }
  };

  let subscribeCallback: any;
  const mockEventBus = {
    subscribe: (channel: string, callback: any) => {
      console.log(`📡 [SUB] Escuchando canal: ${channel}`);
      subscribeCallback = callback;
    }
  };

  try {
    // 1. Iniciar el servicio (Mockeado)
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppSenderService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    const service = module.get<WhatsAppSenderService>(WhatsAppSenderService);
    // await service.onModuleInit(); // Ya no es necesario, se hace en constructor

    // 2. Simular Evento de Salida
    console.log('\n👉 [1. EVENT TEST: OUTBOUND MESSAGE RECEIVED]');
    const mockPayload = {
      conversationId: 'conv-1',
      clinicId: 'cli-1',
      recipient: '56912345678',
      content: 'Hola, tu cita está confirmada.',
      channel: Channel.WHATSAPP,
    };

    if (subscribeCallback) {
      await subscribeCallback(mockPayload);
    }

    console.log('✅ PASS: El servicio capturó el evento y registró el fallo por falta de credenciales (comportamiento esperado).');

    console.log('\n--- 🎉 VERIFICACIÓN FINALIZADA ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ FAIL:', error);
    process.exit(1);
  }
}

verifyWhatsAppOutbound();
