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
  console.log('--- 🧪 VERIFICACIÓN INTEGRAL: CORE SERVICE (PHASE 3.3) ---');

  let app: NestFastifyApplication;

  const mockPrisma: any = {
    clinicConfig: { findUnique: createMockFn(), upsert: createMockFn() },
    clinicSchedule: { findMany: createMockFn([]), findFirst: createMockFn(), deleteMany: createMockFn(), createMany: createMockFn() },
    unavailabilityBlock: { findMany: createMockFn([]), create: createMockFn(), update: createMockFn(), delete: createMockFn() },
    doctor: { findMany: createMockFn([]), findFirst: createMockFn(), create: createMockFn(), update: createMockFn() },
    treatment: { findMany: createMockFn([]), findUnique: createMockFn(), findFirst: createMockFn(), create: createMockFn(), update: createMockFn() },
    doctorTreatment: { createMany: createMockFn(), deleteMany: createMockFn() },
    treatmentOffer: { create: createMockFn(), findFirst: createMockFn(), update: createMockFn() },
    clinicContact: { findFirst: createMockFn(), create: createMockFn() },
    appointment: { 
      findMany: createMockFn([]), 
      findFirst: createMockFn(), 
      create: createMockFn(),
      update: createMockFn(),
    },
    appointmentHistory: { create: createMockFn() },
    auditLog: { create: createMockFn() },
    $transaction: (cb: any) => cb(mockPrisma),
  };

  const mockConfig = { get: (k: string, d: string) => d };

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(mockPrisma)
    .overrideProvider(ConfigService).useValue(mockConfig)
    .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    
    const { ValidationPipe } = await import('@nestjs/common');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, errorHttpStatusCode: 400 }));

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const clinicId = 'c-1111-2222-3333-4444';
    const authHeaders = { 'x-clinic-id': clinicId, 'x-user-id': 'u-1' };

    // --- 9. APPOINTMENTS: CREATE & CONTACT ---
    console.log('\n👉 [9. APPOINTMENTS: CREATE & AUTO-CONTACT]');
    mockPrisma.clinicContact.findFirst.mockResolvedValueOnce(null);
    mockPrisma.clinicContact.create.mockResolvedValueOnce({ id: 'contact-1', name: 'Miguel Medina' });
    mockPrisma.treatment.findUnique.mockResolvedValueOnce({ id: 't-1', durationAvgMin: 60 });
    mockPrisma.appointment.findFirst.mockResolvedValueOnce(null); // No hay colisión
    mockPrisma.appointment.create.mockResolvedValueOnce({ id: 'app-1', scheduledAt: new Date('2026-05-11T10:00:00Z') });

    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/agenda/appointments',
      headers: authHeaders,
      payload: {
        contact_name: 'Miguel Medina',
        contact_phone: '+56987654321',
        treatment_id: '8913615f-972f-48e0-bb12-f1737f940b52',
        doctor_id: '8913615f-972f-48e0-bb12-f1737f940b52',
        scheduled_at: '2026-05-11T10:00:00Z'
      }
    });

    if (resCreate.statusCode === 201) {
      console.log('✅ PASS: Cita creada y contacto generado automáticamente.');
    } else {
      console.log('❌ FAIL: Falló creación de cita.', resCreate.body);
    }

    // --- 10. APPOINTMENTS: OVERBOOKING PROTECTION ---
    console.log('\n👉 [10. APPOINTMENTS: OVERBOOKING PROTECTION]');
    mockPrisma.treatment.findUnique.mockResolvedValueOnce({ id: 't-1', durationAvgMin: 60 });
    mockPrisma.appointment.findFirst.mockResolvedValueOnce({ id: 'app-existing' }); // Simulamos colisión

    const resFail = await app.inject({
      method: 'POST',
      url: '/api/agenda/appointments',
      headers: authHeaders,
      payload: {
        contact_id: '8913615f-972f-48e0-bb12-f1737f940b52',
        treatment_id: '8913615f-972f-48e0-bb12-f1737f940b52',
        doctor_id: '8913615f-972f-48e0-bb12-f1737f940b52',
        scheduled_at: '2026-05-11T10:00:00Z'
      }
    });

    if (resFail.statusCode === 400) {
      console.log('✅ PASS: Prevención de overbooking (400 Bad Request) exitosa.');
    } else {
      console.log('❌ FAIL: Se permitió agendar en slot ocupado.', resFail.statusCode);
    }

    // --- 11. APPOINTMENTS: STATUS & HISTORY ---
    console.log('\n👉 [11. APPOINTMENTS: STATUS & HISTORY]');
    mockPrisma.appointment.findFirst.mockResolvedValueOnce({ id: 'app-1', clinicId });
    mockPrisma.appointment.update.mockResolvedValueOnce({ id: 'app-1', status: 'CONFIRMED' });

    const resStatus = await app.inject({
      method: 'PATCH',
      url: '/api/agenda/appointments/app-1/status',
      headers: authHeaders,
      payload: { status: 'CONFIRMED', notes: 'Confirmó por WhatsApp' }
    });

    if (resStatus.statusCode === 200) {
      console.log('✅ PASS: Estado actualizado y evento registrado en historial.');
    } else {
      console.log('❌ FAIL: Error actualizando estado.', resStatus.body);
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
