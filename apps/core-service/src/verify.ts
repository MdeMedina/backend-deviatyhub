import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { PrismaService } from '@deviaty/shared-prisma';
import { ConfigService } from '@nestjs/config';
import { ConversationGateway } from './conversation/conversation.gateway';

const createMockFn = (returnValue?: any) => {
  const fn = (...args: any[]) => {
    fn.mock.calls.push(args);
    // Ojo: no usar || aquí. Un 0 encolado es un valor legítimo y con || se
    // descartaba silenciosamente, devolviendo el valor por defecto.
    const val = fn.mock.queue.length ? fn.mock.queue.shift() : fn.mock.returnValue;
    return Promise.resolve(val);
  };
  fn.mock = { calls: [] as any[][], returnValue, queue: [] as any[] };
  fn.mockResolvedValueOnce = (val: any) => {
    fn.mock.queue.push(val);
  };
  return fn;
};

async function verifyCoreService() {
  console.log('--- 🧪 VERIFICACIÓN INTEGRAL: CORE SERVICE (PHASE 3.4) ---');

  let app: NestFastifyApplication;

  const mockPrisma: any = {
    clinicConfig: { findUnique: createMockFn(), upsert: createMockFn() },
    clinicSchedule: { findMany: createMockFn([]), findFirst: createMockFn(), deleteMany: createMockFn(), createMany: createMockFn() },
    unavailabilityBlock: { findMany: createMockFn([]), create: createMockFn(), update: createMockFn(), delete: createMockFn() },
    doctor: { findMany: createMockFn([]), findFirst: createMockFn(), create: createMockFn(), update: createMockFn() },
    treatment: { findMany: createMockFn([]), findUnique: createMockFn(), findFirst: createMockFn(), create: createMockFn(), update: createMockFn() },
    doctorTreatment: { createMany: createMockFn(), deleteMany: createMockFn() },
    treatmentOffer: { create: createMockFn(), findFirst: createMockFn(), update: createMockFn() },
    clinicContact: { findFirst: createMockFn(), create: createMockFn(), findMany: createMockFn([]), count: createMockFn(0) },
    appointment: { findMany: createMockFn([]), findFirst: createMockFn(), create: createMockFn(), update: createMockFn(), count: createMockFn(0) },
    appointmentHistory: { create: createMockFn(), count: createMockFn(0) },
    conversation: { 
      findMany: createMockFn([]), 
      findFirst: createMockFn(), 
      update: createMockFn(), 
      count: createMockFn(0) 
    },
    message: { create: createMockFn(), count: createMockFn(0) },
    // Las métricas ya no leen metrics_events (esa tabla nunca se pobló): ahora
    // se calculan sobre conversations, appointments y consultas SQL directas.
    // Un $queryRaw que devuelve [] es seguro para las cuatro consultas: da
    // tiempo de respuesta null, fuera de horario 0 y listas vacías.
    $queryRaw: createMockFn([]),
    auditLog: { create: createMockFn() },
    $transaction: (cb: any) => cb(mockPrisma),
  };

  const mockConfig = { get: (k: string, d: string) => d };
  const mockGateway = {
    emitEvent: (event: string, payload: any) => {
      console.log(`[Mock Gateway] Emitted ${event}:`, payload);
    }
  };

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(mockPrisma)
    .overrideProvider(ConfigService).useValue(mockConfig)
    .overrideProvider(ConversationGateway).useValue(mockGateway)
    .compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter() as any) as any as NestFastifyApplication;
    app.setGlobalPrefix('api');
    const { ValidationPipe } = await import('@nestjs/common');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const clinicId = 'c-1111-2222-3333-4444';
    const authHeaders = { 'x-clinic-id': clinicId, 'x-user-id': 'u-operator-1' };

    // --- 12. CONVERSATIONS: TAKEOVER FLOW ---
    console.log('\n👉 [12. CONVERSATIONS: TAKEOVER & MESSAGE]');
    mockPrisma.conversation.findFirst.mockResolvedValueOnce({ id: 'conv-1', status: 'OPEN', clinicId });
    mockPrisma.conversation.update.mockResolvedValueOnce({ id: 'conv-1', status: 'HUMAN_TAKEOVER' });
    
    const resTakeover = await app.inject({
      method: 'POST',
      url: '/api/conversations/conv-1/takeover',
      headers: authHeaders
    });

    if (resTakeover.statusCode === 201) {
      console.log('✅ PASS: Takeover realizado correctamente.');
    }

    mockPrisma.conversation.findFirst.mockResolvedValueOnce({ id: 'conv-1', status: 'HUMAN_TAKEOVER', clinicId });
    mockPrisma.message.create.mockResolvedValueOnce({ id: 'msg-1', role: 'HUMAN' });
    const resMsg = await app.inject({
      method: 'POST',
      url: '/api/conversations/conv-1/message',
      headers: authHeaders,
      payload: { content: 'Hola, te habla el Dr. Medina.' }
    });

    if (resMsg.statusCode === 201) {
      console.log('✅ PASS: Mensaje manual enviado correctamente en modo takeover.');
    } else {
      console.log('❌ FAIL: No se pudo enviar mensaje manual.', resMsg.body);
    }

    // --- 13. METRICS: SUMMARY AGGREGATION ---
    console.log('\n👉 [13. METRICS: SUMMARY]');
    // El servicio calcula dos ventanas (actual y anterior) para las tendencias.
    // conversation.count se invoca en este orden: conversaciones y derivaciones
    // de la ventana actual, y luego las mismas dos de la anterior.
    mockPrisma.conversation.count.mockResolvedValueOnce(10); // actual: conversaciones
    mockPrisma.conversation.count.mockResolvedValueOnce(2);  // actual: derivadas a humano
    mockPrisma.conversation.count.mockResolvedValueOnce(0);  // anterior: conversaciones
    mockPrisma.conversation.count.mockResolvedValueOnce(0);  // anterior: derivadas

    const resMetrics = await app.inject({
      method: 'GET',
      url: '/api/metrics/summary?period=7',
      headers: authHeaders
    });

    const metricsBody = JSON.parse(resMetrics.body);
    const m = metricsBody.data || {};

    const checks: [string, boolean][] = [
      ['responde 200', resMetrics.statusCode === 200 && metricsBody.success === true],
      ['containment rate 0.8 (8 de 10 sin derivar)', m.containment_rate === 0.8],
      ['conversaciones atendidas 10', m.conversations_attended === 10],
      ['derivaciones a humano 2', m.human_takeovers === 2],
      ['tiempo de respuesta null si no hay pares', m.avg_response_time_ms === null],
      ['fuera de horario 0', m.out_of_hours_conversations === 0],
      ['histograma con las 24 horas', Array.isArray(m.interactions_by_hour) && m.interactions_by_hour.length === 24],
      ['intenciones como lista', Array.isArray(m.intentions_distribution)],
      ['incluye tendencias', !!m.trends],
      // Sin actividad previa la variación es indefinida: debe ser null, no 0%.
      ['sin base de comparación no inventa tendencia', m.trends?.conversations_attended === null],
    ];

    const failed = checks.filter(([, ok]) => !ok);
    if (failed.length === 0) {
      console.log(`✅ PASS: Métricas calculadas sobre datos reales (${checks.length} comprobaciones).`);
    } else {
      console.log('❌ FAIL: Métricas incorrectas:');
      failed.forEach(([name]) => console.log(`   - ${name}`));
      console.log('   respuesta:', JSON.stringify(m));
    }

    console.log('\n--- 🎉 VERIFICACIÓN FINALIZADA ---');
    await app.close();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ ERROR FATAL en verificación:', error.message);
    process.exit(1);
  }
}

verifyCoreService();
