import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { PrismaService } from '@deviaty/shared-prisma';
import { ConfigService } from '@nestjs/config';

const createMockFn = (returnValue?: any) => {
  const fn = (...args: any[]) => {
    fn.mock.calls.push(args);
    const val = fn.mock.queue.shift() || fn.mock.returnValue;
    return Promise.resolve(val);
  };
  fn.mock = { calls: [] as any[][], returnValue, queue: [] as any[] };
  fn.mockResolvedValueOnce = (val: any) => {
    fn.mock.queue.push(val);
  };
  return fn;
};

async function verifyCoreService() {
  console.log('--- 🧪 VERIFICACIÓN INTEGRAL: CORE SERVICE (CLINIC & AGENDA) ---');

  let app: NestFastifyApplication;

  const mockPrisma = {
    clinicConfig: {
      findUnique: createMockFn(),
      upsert: createMockFn(),
    },
    clinicSchedule: {
      findMany: createMockFn([]),
      deleteMany: createMockFn(),
      createMany: createMockFn(),
    },
    unavailabilityBlock: {
      findMany: createMockFn([]),
      create: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    policy: {
      findMany: createMockFn([]),
      create: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    auditLog: { create: createMockFn() },
    $transaction: (cb: any) => cb(mockPrisma),
  };

  const mockConfig = { get: (k: string, d: string) => d };

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(PrismaService).useValue(mockPrisma)
    .overrideProvider(ConfigService).useValue(mockConfig)
    .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    
    // IMPORTANTE: Activar validaciones en el test
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

    // --- 1. CLINIC: CONFIG ---
    console.log('\n👉 [1. CLINIC: CONFIG]');
    (mockPrisma.clinicConfig.upsert as any).mockResolvedValueOnce({
      clinicId, name: 'Clínica de Prueba', timezone: 'UTC'
    });
    
    const resConfig = await app.inject({
      method: 'PATCH',
      url: '/api/clinic/config',
      headers: authHeaders,
      payload: { name: 'Clínica de Prueba', timezone: 'UTC' }
    });
    
    const configBody = JSON.parse(resConfig.body);
    if (resConfig.statusCode === 200 && configBody.success && configBody.data.name === 'Clínica de Prueba') {
      console.log('✅ PASS: Configuración creada/actualizada y normalizada.');
    } else {
      console.log('❌ FAIL: Configuración falló.', configBody);
    }

    // --- 2. CLINIC: SCHEDULES ---
    console.log('\n👉 [2. CLINIC: SCHEDULES]');
    const resSchedules = await app.inject({
      method: 'PUT',
      url: '/api/clinic/schedules',
      headers: authHeaders,
      payload: {
        schedules: [
          { day_of_week: 1, open_time: '09:00', close_time: '18:00' },
          { day_of_week: 2, open_time: '09:00', close_time: '18:00' }
        ]
      }
    });
    
    const scheduleBody = JSON.parse(resSchedules.body);
    if (resSchedules.statusCode === 200 && scheduleBody.success) {
      console.log('✅ PASS: Horarios actualizados mediante transacción.');
    } else {
      console.log('❌ FAIL: Horarios fallaron.', scheduleBody);
    }

    // --- 3. CLINIC: UNAVAILABILITY ---
    console.log('\n👉 [3. CLINIC: UNAVAILABILITY]');
    (mockPrisma.unavailabilityBlock.create as any).mockResolvedValueOnce({
        id: 'u-1', name: 'Almuerzo'
    });
    const resUnavail = await app.inject({
      method: 'POST',
      url: '/api/clinic/unavailability',
      headers: authHeaders,
      payload: {
        name: 'Almuerzo',
        days_of_week: [1, 2, 3, 4, 5],
        start_time: '13:00',
        end_time: '14:00'
      }
    });

    const unavailBody = JSON.parse(resUnavail.body);
    if (resUnavail.statusCode === 201 && unavailBody.success) {
      console.log('✅ PASS: Bloque de no disponibilidad creado.');
    } else {
      console.log('❌ FAIL: Inavailability falló.', unavailBody);
    }

    // --- 4. FAIL: VALIDATION ---
    console.log('\n👉 [4. FAIL: VALIDATION]');
    const resFail = await app.inject({
      method: 'PUT',
      url: '/api/clinic/schedules',
      headers: authHeaders,
      payload: {
        schedules: [{ day_of_week: 9, open_time: '09:00', close_time: '18:00' }] // Día inválido
      }
    });
    
    const failBody = JSON.parse(resFail.body);
    if (resFail.statusCode === 400 && !failBody.success && failBody.error.code === 'VALIDATION_ERROR') {
      console.log('✅ PASS: Validación de día (0-6) capturada correctamente.');
    } else {
      console.log('❌ FAIL: La validación no bloqueó el valor inválido.', failBody);
    }

    // --- 5. FAIL: NOT FOUND ---
    console.log('\n👉 [5. FAIL: NOT FOUND]');
    (mockPrisma.clinicConfig.findUnique as any).mockResolvedValueOnce(null);
    const resNotFound = await app.inject({
      method: 'GET',
      url: '/api/clinic/config',
      headers: { 'x-clinic-id': 'non-existent-uuid', 'x-user-id': 'u-1' }
    });
    
    if (resNotFound.statusCode === 404) {
      console.log('✅ PASS: Clínica inexistente retorna 404.');
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
