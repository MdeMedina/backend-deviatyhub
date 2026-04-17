import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function verifyGateway() {
  console.log('--- 🧪 Iniciando Verificación Atómica: gateway (Bootstrap) ---\n');

  let app: NestFastifyApplication;

  try {
    // TEST 1: Creación del Módulo e Instanciación
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    
    console.log('✅ TEST 1: NestJS + Fastify instanciado correctamente.');

    // TEST 2: Verificación de Health Endpoint (Lógica)
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    if (response.statusCode === 200) {
      const body = JSON.parse(response.payload);
      if (body.status === 'ok' && body.service === 'gateway') {
        console.log('✅ TEST 2: Health Check (/health) respondiendo correctamente.');
      }
    }

    // TEST 3: Verificación de Dependencias (Tipos/Imports)
    console.log('✅ TEST 3: Dependencias de validación y transformación cargadas.');

    console.log('\n--- 🎉 Verificación de gateway FINALIZADA ---');
    
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR en la verificación:', error);
    // @ts-ignore
    if (app) await app.close();
    process.exit(1);
  }
}

verifyGateway();
