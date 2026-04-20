"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("./app.module");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const mailer_1 = require("@nestjs-modules/mailer");
const shared_events_1 = require("@deviaty/shared-events");
const config_1 = require("@nestjs/config");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const createMockFn = (returnValue) => {
    const fn = (...args) => {
        fn.mock.calls.push(args);
        return Promise.resolve(fn.mock.returnValue);
    };
    fn.mock = { calls: [], returnValue };
    return fn;
};
async function verifyNotificationService() {
    console.log('--- 🧪 VERIFICACIÓN: NOTIFICATION SERVICE (PHASE 4) ---');
    const mockMailer = {
        sendMail: createMockFn({ messageId: '123' }),
    };
    const mockPrisma = {
        clinic: { findUnique: createMockFn({ id: 'c-1', name: 'Dental Care Plus', address: 'Av. Providencia 1234' }) },
        appointment: {
            findUnique: createMockFn({
                id: 'app-1',
                scheduledAt: new Date('2026-05-20T10:00:00Z'),
                contact: { name: 'Juan Perez', email: 'juan@example.com' },
                clinic: { name: 'Dental Care Plus' },
                doctor: { name: 'Dra. Smith' },
                treatment: { name: 'Limpieza Dental' },
            }),
        },
    };
    const mockConfig = {
        get: (key, defaultValue) => {
            if (key === 'FRONTEND_URL')
                return 'https://app.deviaty.com';
            if (key === 'GMAIL_USER')
                return 'no-reply@deviaty.com';
            return defaultValue;
        }
    };
    // Mock EventBus para interceptar handlers
    const handlers = {};
    const mockEventBus = {
        subscribe: (channel, handler) => {
            handlers[channel] = handler;
        },
        publish: createMockFn(),
    };
    try {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        })
            .overrideProvider(mailer_1.MailerService).useValue(mockMailer)
            .overrideProvider(shared_prisma_1.PrismaService).useValue(mockPrisma)
            .overrideProvider(shared_events_1.EventBus).useValue(mockEventBus)
            .overrideProvider(config_1.ConfigService).useValue(mockConfig)
            .compile();
        const app = moduleFixture.createNestApplication(new platform_fastify_1.FastifyAdapter());
        await app.init();
        // --- 1. TEST: USER INVITATION ---
        console.log('\n👉 [1. EVENT: USER_INVITED]');
        const invitePayload = {
            email: 'test@deviaty.com',
            name: 'Test Admin',
            clinicId: 'c-1',
            token: 'secret-token-123'
        };
        if (handlers[shared_events_1.REDIS_CHANNELS.USER_INVITED]) {
            await handlers[shared_events_1.REDIS_CHANNELS.USER_INVITED](invitePayload);
            const lastMail = mockMailer.sendMail.mock.calls[mockMailer.sendMail.mock.calls.length - 1][0];
            if (lastMail.to === invitePayload.email && lastMail.template === 'invitation') {
                console.log('✅ PASS: Email de invitación orquestado correctamente.');
                console.log(`   Link generado: ${lastMail.context.inviteLink}`);
            }
            else {
                console.log('❌ FAIL: Parámetros de invitación incorrectos.');
            }
        }
        // --- 2. TEST: APPOINTMENT CONFIRMATION ---
        console.log('\n👉 [2. EVENT: APPOINTMENT_SCHEDULED]');
        const appointmentPayload = {
            appointmentId: 'app-1',
            clinicId: 'c-1'
        };
        if (handlers[shared_events_1.REDIS_CHANNELS.APPOINTMENT_SCHEDULED]) {
            await handlers[shared_events_1.REDIS_CHANNELS.APPOINTMENT_SCHEDULED](appointmentPayload);
            const lastMail = mockMailer.sendMail.mock.calls[mockMailer.sendMail.mock.calls.length - 1][0];
            if (lastMail.to === 'juan@example.com' && lastMail.template === 'appointment-confirmation') {
                console.log('✅ PASS: Confirmación de cita orquestada correctamente.');
                console.log(`   Paciente: ${lastMail.context.patientName}, Fecha: ${lastMail.context.date}`);
            }
            else {
                console.log('❌ FAIL: Parámetros de cita incorrectos.');
            }
        }
        console.log('\n--- 🎉 VERIFICACIÓN FINALIZADA ---');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ ERROR FATAL en verificación:', error.message);
        process.exit(1);
    }
}
verifyNotificationService();
//# sourceMappingURL=verify.js.map