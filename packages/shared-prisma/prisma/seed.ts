import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Deviaty (idempotente + datos de simulación)...');

  // ── 1. Clínica + configuración ────────────────────────────────
  const clinic = await prisma.clinic.upsert({
    where: { slug: 'deviaty-clinic' },
    update: {},
    create: {
      name: 'Deviaty Clinic',
      slug: 'deviaty-clinic',
      billingEmail: 'admin@deviaty.com',
      configs: {
        create: {
          name: 'Deviaty Clinic Central',
          address: 'Av. Providencia 1234, Santiago, Chile',
          phone: '+56912345678',
          email: 'contacto@deviaty.com',
          timezone: 'America/Santiago',
        },
      },
    },
  });
  const clinicId = clinic.id;

  // ── 2. Rol Superadmin ─────────────────────────────────────────
  let superadminRole = await prisma.role.findFirst({
    where: { clinicId, name: 'Superadmin' },
  });
  if (!superadminRole) {
    superadminRole = await prisma.role.create({
      data: {
        clinicId,
        name: 'Superadmin',
        isSuperadmin: true,
        permissions: {
          all: true,
          users: ['create', 'read', 'update', 'delete'],
          clinic: ['update'],
          doctors: ['create', 'read', 'update', 'delete'],
        },
      },
    });
  }

  // ── 3. Usuario de prueba ──────────────────────────────────────
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
  const user = await prisma.user.upsert({
    where: { email: 'mamedina770@gmail.com' },
    update: { passwordHash, roleId: superadminRole.id, clinicId },
    create: {
      email: 'mamedina770@gmail.com',
      passwordHash,
      clinicId,
      roleId: superadminRole.id,
      active: true,
    },
  });
  console.log(`✅ Usuario: ${user.email}  🔑 ${password}`);

  // ── 4. Reset del dataset de simulación (orden FK-safe) ─────────
  // Se regenera de forma determinista en cada ejecución.
  await prisma.appointmentHistory.deleteMany({ where: { appointment: { clinicId } } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.doctorTreatment.deleteMany({ where: { clinicId } });
  await prisma.treatmentOffer.deleteMany({ where: { clinicId } });
  await prisma.treatment.deleteMany({ where: { clinicId } });
  await prisma.doctor.deleteMany({ where: { clinicId } });
  await prisma.clinicSchedule.deleteMany({ where: { clinicId } });

  // ── 5. Doctores ───────────────────────────────────────────────
  const drMedina = await prisma.doctor.create({
    data: { clinicId, name: 'Dr. Miguel Medina', title: 'Odontólogo General', active: true },
  });
  const draLopez = await prisma.doctor.create({
    data: { clinicId, name: 'Dra. Ana López', title: 'Ortodoncista', active: true },
  });

  // ── 6. Tratamientos (catálogo con precios Isapre/Fonasa) ──────
  const T = (data: {
    name: string; category: string; durationMin: number; price: number;
    description: string; isapre?: boolean; fonasa?: boolean;
  }) =>
    prisma.treatment.create({
      data: {
        clinicId,
        name: data.name,
        category: data.category,
        durationMin: data.durationMin,
        durationAvgMin: data.durationMin,
        price: data.price,
        priceIsapre: data.isapre ? Math.round(data.price * 0.7) : null,
        priceFonasa: data.fonasa ? Math.round(data.price * 0.5) : null,
        acceptsIsapre: !!data.isapre,
        acceptsFonasa: !!data.fonasa,
        description: data.description,
        active: true,
      },
    });

  const limpieza = await T({ name: 'Limpieza Dental', category: 'Preventivo', durationMin: 30, price: 25000, description: 'Profilaxis y destartraje completo.', isapre: true, fonasa: true });
  const consulta = await T({ name: 'Consulta General', category: 'Diagnóstico', durationMin: 20, price: 15000, description: 'Evaluación odontológica general y diagnóstico.', isapre: true, fonasa: true });
  const obturacion = await T({ name: 'Obturación (Tapadura)', category: 'Restauración', durationMin: 45, price: 40000, description: 'Restauración de caries con resina.', isapre: true, fonasa: false });
  const endodoncia = await T({ name: 'Endodoncia', category: 'Restauración', durationMin: 60, price: 148000, description: 'Tratamiento de conducto, incluye control posterior.', isapre: false, fonasa: true });
  const ortodoncia = await T({ name: 'Ortodoncia - Evaluación', category: 'Ortodoncia', durationMin: 30, price: 20000, description: 'Evaluación inicial para tratamiento de ortodoncia.', isapre: true, fonasa: false });

  // ── 7. Vínculos doctor ↔ tratamiento ──────────────────────────
  const link = (doctorId: string, treatmentId: string) =>
    prisma.doctorTreatment.create({ data: { clinicId, doctorId, treatmentId } });
  await link(drMedina.id, limpieza.id);
  await link(drMedina.id, consulta.id);
  await link(drMedina.id, obturacion.id);
  await link(drMedina.id, endodoncia.id);
  await link(draLopez.id, consulta.id);
  await link(draLopez.id, limpieza.id);
  await link(draLopez.id, ortodoncia.id);

  // ── 8. Horarios de la clínica (L–S 09:00–18:00, Dom cerrado) ──
  for (let dow = 0; dow < 7; dow++) {
    await prisma.clinicSchedule.create({
      data: { clinicId, dayOfWeek: dow, openTime: '09:00', closeTime: '18:00', isOpen: dow !== 0 },
    });
  }

  // ── 9. Contacto de prueba (paciente) ──────────────────────────
  const DEMO_PHONE = '+56981234477';
  let contact = await prisma.clinicContact.findFirst({ where: { clinicId, phone: DEMO_PHONE } });
  if (!contact) {
    contact = await prisma.clinicContact.create({
      data: { clinicId, name: 'María González', phone: DEMO_PHONE, email: 'paciente@correo.com', lastInteractionAt: new Date() },
    });
  }

  // ── 10. Citas futuras (para reprogramar / cancelar / agenda) ──
  const at = (daysAhead: number, h: number, m: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysAhead);
    d.setHours(h, m, 0, 0);
    return d;
  };
  await prisma.appointment.create({
    data: { clinicId, contactId: contact.id, contactName: contact.name, doctorId: drMedina.id, treatmentId: limpieza.id, scheduledAt: at(3, 11, 0), durationMin: 30, status: 'CONFIRMED', source: 'HUMAN', notes: 'Cita de ejemplo (limpieza).' },
  });
  await prisma.appointment.create({
    data: { clinicId, contactId: contact.id, contactName: contact.name, doctorId: draLopez.id, treatmentId: consulta.id, scheduledAt: at(6, 16, 30), durationMin: 20, status: 'PENDING', source: 'AGENT', notes: 'Cita de ejemplo (consulta).' },
  });

  // ── 11. Configuración del agente (acciones por defecto) ───────
  // Solo se crea si no existe: NO sobrescribe los toggles que el usuario
  // haya cambiado en la UI de "Acciones del agente".
  const defaultActions = {
    schedule: { active: true, channels: ['WHATSAPP', 'INSTAGRAM'], integrations: ['GOOGLE_CALENDAR'] },
    reschedule: { active: true, channels: ['WHATSAPP'], integrations: ['GOOGLE_CALENDAR'] },
    cancel: { active: true, channels: ['WHATSAPP'], integrations: [] },
  };
  await prisma.agentConfig.upsert({
    where: { clinicId },
    update: {},
    create: { clinicId, actions: defaultActions },
  });

  console.log('✅ Datos de simulación listos: 2 doctores, 5 tratamientos, 7 vínculos, horarios L–S, 1 contacto, 2 citas, agentConfig.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
