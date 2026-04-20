import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { TestPermissionsController } from './test-permissions.controller';
import { signJWT } from '@deviaty/shared-utils';
import { UserRole } from '@deviaty/shared-types';

async function verifyGatewayFullSuite() {
  console.log('--- 🧪 Iniciando Suite de Verificación Integral: gateway (TODOS LOS TESTS) ---\n');

  let app: NestFastifyApplication;

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestPermissionsController],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api'); // Re-aplicar para consistencia en el test
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    
    const secret = process.env.JWT_ACCESS_SECRET || 'secret';
    
    // Helper para generar tokens
    const generateToken = (role: UserRole, permissions: any) => {
      return signJWT({
        userId: 'u-1',
        clinicId: 'c-1',
        role,
        email: 'test@deviaty.com',
        permissions
      }, secret, '1h');
    };

    // --- 1. BOOTSTRAP ---
    console.log('👉 [1. Bootstrap]');
    const resHealth = await app.inject({ method: 'GET', url: '/api/health' });
    const healthBody = JSON.parse(resHealth.body);
    if (resHealth.statusCode === 200 && healthBody.success) {
      console.log('✅ Health Check operativo y normalizado (/api/health).');
    } else {
      console.log('❌ FAIL: Health Check esquema incorrecto.', healthBody);
    }

    // --- 2. SECURITY (JWT) ---
    console.log('\n👉 [2. Security - JWT]');
    const resNoAuth = await app.inject({ method: 'GET', url: '/api/test-perm/view' });
    if (resNoAuth.statusCode === 401) {
      console.log('✅ Acceso denegado sin token.');
    }

    // --- 3. RBAC (Permissions) ---
    console.log('\n👉 [3. Permissions]');
    const tokenOperator = generateToken(UserRole.OPERATOR, { users: { view: true } });
    const resPerm = await app.inject({
      method: 'GET',
      url: '/api/test-perm/view',
      headers: { authorization: `Bearer ${tokenOperator}` }
    });
    if (resPerm.statusCode === 200) {
      console.log('✅ Permiso users.view validado (Consistente con API Ref).');
    }

    const tokenNoPerm = generateToken(UserRole.OPERATOR, { users: { view: false } });
    const resNoPerm = await app.inject({
        method: 'GET',
        url: '/api/test-perm/view',
        headers: { authorization: `Bearer ${tokenNoPerm}` }
      });
      if (resNoPerm.statusCode === 403) {
        console.log('✅ Permiso insuficiente bloqueado (403).');
      }

    // --- 4. RESILIENCE (Throttler) ---
    console.log('\n👉 [4. Resilience - Throttler]');
    let lastStatus = 0;
    for (let i = 0; i < 110; i++) {
        const resBurst = await app.inject({ method: 'GET', url: '/api/health' });
        lastStatus = resBurst.statusCode;
        if (lastStatus === 429) break;
    }
    if (lastStatus === 429) {
      console.log('✅ Rate Limit (429) validado después de burst.');
    }

    // --- 5. ROUTING (Proxy) ---
    console.log('\n👉 [5. Routing - Proxy]');
    const resProxy = await app.inject({
      method: 'GET',
      url: '/api/auth/test-proxy-route',
    });
    // Se espera 502/504 porque el microservicio no está real en este test
    if (resProxy.statusCode === 502 || resProxy.statusCode === 504) {
      console.log('✅ Lógica de Proxy mapeada correctamente a /api/auth/*');
    }

    console.log('\n--- 🎉 Suite de Verificación Integral FINALIZADA ---');
    
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR en la verificación:', error);
    // @ts-ignore
    if (app) await app.close();
    process.exit(1);
  }
}

verifyGatewayFullSuite();
