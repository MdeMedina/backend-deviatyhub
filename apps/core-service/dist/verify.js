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
    console.log('--- 🧪 VERIFICACIÓN INTEGRAL: CORE SERVICE (PHASE 3.2) ---');
    let app;
    const mockPrisma = {
        clinicConfig: {
            findUnique: createMockFn(),
            upsert: createMockFn(),
        },
        clinicSchedule: {
            findMany: createMockFn([]),
            findFirst: createMockFn(),
            deleteMany: createMockFn(),
            createMany: createMockFn(),
        },
        unavailabilityBlock: {
            findMany: createMockFn([]),
            create: createMockFn(),
            update: createMockFn(),
            delete: createMockFn(),
        },
        doctor: {
            findMany: createMockFn([]),
            findFirst: createMockFn(),
            create: createMockFn(),
            update: createMockFn(),
        },
        treatment: {
            findMany: createMockFn([]),
            findUnique: createMockFn(),
            findFirst: createMockFn(),
            create: createMockFn(),
            update: createMockFn(),
        },
        doctorTreatment: {
            createMany: createMockFn(),
            deleteMany: createMockFn(),
        },
        treatmentOffer: {
            create: createMockFn(),
            findFirst: createMockFn(),
            update: createMockFn(),
        },
        appointment: {
            findMany: createMockFn([]),
        },
        dentalEntry: {
            findMany: createMockFn([]),
        },
        auditLog: { create: createMockFn() },
        $transaction: (cb) => cb(mockPrisma),
    };
    const mockConfig = { get: (k, d) => d };
    try {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        })
            .overrideProvider(shared_prisma_1.PrismaService).useValue(mockPrisma)
            .overrideProvider(config_1.ConfigService).useValue(mockConfig)
            .compile();
        app = moduleFixture.createNestApplication(new platform_fastify_1.FastifyAdapter());
        app.setGlobalPrefix('api');
        const { ValidationPipe } = await import('@nestjs/common');
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            errorHttpStatusCode: 400,
        }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
        const clinicId = 'c-1111-2222-3333-4444';
        const authHeaders = { 'x-clinic-id': clinicId, 'x-user-id': 'u-1' };
        // --- 1. DOCTORS ---
        console.log('\n👉 [6. DOCTORS: CRUD]');
        mockPrisma.doctor.create.mockResolvedValueOnce({ id: 'd-1', name: 'Dr. Medina', title: 'Dentista' });
        const resDoctor = await app.inject({
            method: 'POST',
            url: '/api/doctors',
            headers: authHeaders,
            payload: { name: 'Dr. Medina', title: 'Dentista', treatment_ids: ['t-1'] }
        });
        if (resDoctor.statusCode === 201) {
            console.log('✅ PASS: Doctor creado y registrado exitosamente.');
        }
        else {
            console.log('❌ FAIL: Falló creación de doctor.', resDoctor.body);
        }
        // --- 2. TREATMENTS ---
        console.log('\n👉 [7. TREATMENTS: CRUD]');
        mockPrisma.treatment.create.mockResolvedValueOnce({ id: 't-1', name: 'Limpieza', category: 'General' });
        const resTreat = await app.inject({
            method: 'POST',
            url: '/api/treatments',
            headers: authHeaders,
            payload: { name: 'Limpieza', category: 'General', duration_avg_min: 45 }
        });
        if (resTreat.statusCode === 201) {
            console.log('✅ PASS: Tratamiento registrado correctamente.');
        }
        else {
            console.log('❌ FAIL: Falló creación de tratamiento.', resTreat.body);
        }
        // --- 3. AGENDA: SLOTS ---
        console.log('\n👉 [8. AGENDA: SLOTS]');
        // Mock escenario: Lunes, abre 09:00 a 18:00, tratamiento 60 min
        mockPrisma.clinicSchedule.findFirst.mockResolvedValueOnce({ openTime: '09:00', closeTime: '12:00', isOpen: true });
        mockPrisma.treatment.findUnique.mockResolvedValueOnce({ durationAvgMin: 60 });
        const resSlots = await app.inject({
            method: 'GET',
            url: '/api/agenda/slots?date=2026-05-11&treatment_id=t-1', // 2026-05-11 es lunes
            headers: authHeaders
        });
        const slotsBody = JSON.parse(resSlots.body);
        if (resSlots.statusCode === 200 && slotsBody.success && slotsBody.data.length > 0) {
            console.log(`✅ PASS: Slots generados exitosamente (${slotsBody.data.length} slots encontrados).`);
            console.log('   Ejemplo de slot:', slotsBody.data[0]);
        }
        else {
            console.log('❌ FAIL: El cálculo de slots falló.', slotsBody);
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