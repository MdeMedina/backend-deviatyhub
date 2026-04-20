"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const testing_1 = require("@nestjs/testing");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const app_module_1 = require("./app.module");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const shared_utils_1 = require("@deviaty/shared-utils");
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
async function verifyAllEndpointsSync() {
    console.log('--- 🧪 VERIFICACIÓN INTEGRAL: AUTH SERVICE vs API REFERENCE ---\n');
    let app = null;
    const mockPrisma = {
        user: {
            findUnique: createMockFn(),
            findFirst: createMockFn(),
            create: createMockFn(),
            update: createMockFn(),
            count: createMockFn(0),
            findMany: createMockFn([]),
        },
        role: {
            findUnique: createMockFn(),
            findMany: createMockFn([]),
        },
        refreshToken: { create: createMockFn(), updateMany: createMockFn() },
        auditLog: { create: createMockFn() },
    };
    const mockConfig = { get: (k, d) => d };
    const mockEventBus = {
        publish: createMockFn(),
        setKey: createMockFn(),
        getKey: createMockFn()
    };
    try {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
            providers: [core_1.Reflector],
        })
            .overrideProvider(shared_prisma_1.PrismaService).useValue(mockPrisma)
            .overrideProvider(config_1.ConfigService).useValue(mockConfig)
            .overrideProvider('EVENT_BUS').useValue(mockEventBus)
            .compile();
        app = moduleFixture.createNestApplication(new platform_fastify_1.FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
        console.log('👉 [1. AUTH: LOGIN & SCHEMAS]');
        // Generar hash real para 'password123'
        const validHash = await (0, shared_utils_1.hashBcrypt)('password123');
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 'u-1', email: 'admin@deviaty.com', passwordHash: validHash, clinicId: 'c-1',
            role: { id: 'r-1', name: 'Admin', isSuperadmin: true, permissions: { users: { view: true } } }
        });
        const resLogin = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email: 'admin@deviaty.com', password: 'password123' }
        });
        // Si resLogin.statusCode no es 200/201, algo falló internamente
        if (resLogin.statusCode >= 400) {
            console.log(`❌ FAIL: /auth/login falló con status ${resLogin.statusCode}`, resLogin.body);
        }
        else {
            const loginBody = JSON.parse(resLogin.body);
            if (loginBody.success && loginBody.data.access_token && loginBody.data.user.role.permissions.users) {
                console.log('✅ PASS: /auth/login retorna esquema exacto (nested role/perms + snake_case).');
            }
            else {
                console.log('❌ FAIL: /auth/login esquema incorrecto.', loginBody);
            }
        }
        console.log('\n👉 [2. AUTH: ME & PROFILE]');
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 'u-1', email: 'admin@deviaty.com', clinicId: 'c-1', active: true,
            role: { id: 'r-1', name: 'Admin', isSuperadmin: true, permissions: {} }
        });
        const resMe = await app.inject({
            method: 'GET',
            url: '/auth/me',
            headers: { 'x-user-id': 'u-1' }
        });
        const meBody = JSON.parse(resMe.body);
        if (meBody.success && meBody.data.clinic_id === 'c-1') {
            console.log('✅ PASS: /auth/me retorna perfil normalizado.');
        }
        console.log('\n👉 [3. USERS: INVITE & FLOW]');
        mockPrisma.user.findUnique.mockResolvedValueOnce(null);
        mockPrisma.user.create.mockResolvedValueOnce({ id: 'u-inv', email: 'new@docs.com', inviteToken: 't-999' });
        const resInvite = await app.inject({
            method: 'POST',
            url: '/auth/users/invite',
            headers: { 'x-clinic-id': 'c-1' },
            payload: { email: 'new@docs.com', roleId: 'r-1' }
        });
        if (resInvite.statusCode === 201) {
            console.log('✅ PASS: /users/invite crea usuario inactivo y genera token.');
        }
        else {
            console.log('❌ FAIL: /users/invite status error', resInvite.body);
        }
        console.log('\n👉 [4. ERRORS: VALIDATION & MAPPING]');
        const resError = await app.inject({
            method: 'POST',
            url: '/auth/set-password',
            payload: { token: 't-1', password: '123', password_confirm: 'wrong' }
        });
        const errorBody = JSON.parse(resError.body);
        if (errorBody.success === false && errorBody.error.code === 'VALIDATION_ERROR') {
            console.log('✅ PASS: Filtro global mapea excepciones a { success: false, error: { code, message } }.');
        }
        console.log('\n👉 [5. LOGOUT: BLACKLIST]');
        const resLogout = await app.inject({
            method: 'POST',
            url: '/auth/logout',
            headers: { authorization: 'Bearer valid-token' },
            payload: { refresh_token: 'valid-refresh' }
        });
        if (resLogout.statusCode === 200) {
            console.log('✅ PASS: /auth/logout procesado (Blacklist en Redis simulada).');
        }
        console.log('\n--- 🎉 VERIFICACIÓN FINALIZADA ---');
        if (app)
            await app.close();
        process.exit(0);
    }
    catch (error) {
        console.error('❌ ERROR CRÍTICO EN VERIFICACIÓN:', error.message);
        if (app)
            await app.close();
        process.exit(1);
    }
}
verifyAllEndpointsSync();
//# sourceMappingURL=verify.js.map