"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const testing_1 = require("@nestjs/testing");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const app_module_1 = require("./app.module");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const config_1 = require("@nestjs/config");
const createMockFn = (returnValue) => {
    const fn = (...args) => {
        fn.mock.calls.push(args);
        const val = fn.mock.queue.shift() || fn.mock.returnValue;
        return Promise.resolve(val);
    };
    fn.mock = { calls: [], returnValue, queue: [] };
    fn.mockResolvedValueOnce = (val) => {
        fn.mock.queue.push(val);
    };
    return fn;
};
async function verifyCoreService() {
    console.log('--- 🧪 VERIFICACIÓN INTEGRAL: CORE SERVICE (PHASE 3.4) ---');
    let app;
    const mockPrisma = {
        clinicConfig: { findUnique: createMockFn(), upsert: createMockFn() },
        clinicSchedule: { findMany: createMockFn([]), findFirst: createMockFn(), deleteMany: createMockFn(), createMany: createMockFn() },
        unavailabilityBlock: { findMany: createMockFn([]), create: createMockFn(), update: createMockFn(), delete: createMockFn() },
        doctor: { findMany: createMockFn([]), findFirst: createMockFn(), create: createMockFn(), update: createMockFn() },
        treatment: { findMany: createMockFn([]), findUnique: createMockFn(), findFirst: createMockFn(), create: createMockFn(), update: createMockFn() },
        doctorTreatment: { createMany: createMockFn(), deleteMany: createMockFn() },
        treatmentOffer: { create: createMockFn(), findFirst: createMockFn(), update: createMockFn() },
        clinicContact: { findFirst: createMockFn(), create: createMockFn(), findMany: createMockFn([]), count: createMockFn(0) },
        appointment: { findMany: createMockFn([]), findFirst: createMockFn(), create: createMockFn(), update: createMockFn() },
        appointmentHistory: { create: createMockFn() },
        conversation: {
            findMany: createMockFn([]),
            findFirst: createMockFn(),
            update: createMockFn(),
            count: createMockFn(0)
        },
        message: { create: createMockFn(), count: createMockFn(0) },
        metricsEvent: { count: createMockFn(0), groupBy: createMockFn([]) },
        auditLog: { create: createMockFn() },
        $transaction: (cb) => cb(mockPrisma),
    };
    const mockConfig = { get: (k, d) => d };
    try {
        const moduleFixture = await testing_1.Test.createTestingModule({ imports: [app_module_1.AppModule] })
            .overrideProvider(shared_prisma_1.PrismaService).useValue(mockPrisma)
            .overrideProvider(config_1.ConfigService).useValue(mockConfig)
            .compile();
        app = moduleFixture.createNestApplication(new platform_fastify_1.FastifyAdapter());
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
        }
        else {
            console.log('❌ FAIL: No se pudo enviar mensaje manual.', resMsg.body);
        }
        // --- 13. METRICS: SUMMARY AGGREGATION ---
        console.log('\n👉 [13. METRICS: SUMMARY]');
        mockPrisma.conversation.count.mockResolvedValueOnce(10); // convCount
        mockPrisma.metricsEvent.count.mockResolvedValueOnce(2); // appScheduled
        mockPrisma.metricsEvent.count.mockResolvedValueOnce(0); // appRescheduled
        mockPrisma.metricsEvent.count.mockResolvedValueOnce(0); // appCancelled
        mockPrisma.metricsEvent.count.mockResolvedValueOnce(2); // takeovers
        mockPrisma.metricsEvent.groupBy.mockResolvedValueOnce([
            { intention: 'agendar_cita', _count: { _all: 5 } }
        ]);
        const resMetrics = await app.inject({
            method: 'GET',
            url: '/api/metrics/summary?period=7',
            headers: authHeaders
        });
        const metricsBody = JSON.parse(resMetrics.body);
        if (resMetrics.statusCode === 200 && metricsBody.success && metricsBody.data.containment_rate === 0.8) {
            console.log('✅ PASS: Métricas calculadas correctamente (Containment Rate 0.8).');
        }
        else {
            console.log('❌ FAIL: El cálculo de métricas es incorrecto.', metricsBody);
        }
        console.log('\n--- 🎉 VERIFICACIÓN FINALIZADA ---');
        await app.close();
        process.exit(0);
    }
    catch (error) {
        console.error('❌ ERROR FATAL en verificación:', error.message);
        process.exit(1);
    }
}
verifyCoreService();
//# sourceMappingURL=verify.js.map