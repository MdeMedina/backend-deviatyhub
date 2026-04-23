import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seeding...');

  // 1. Limpieza de datos (Opcional, pero recomendado para tests determinísticos)
  // await prisma.message.deleteMany();
  // await prisma.conversation.deleteMany();
  // ... añadir más si es necesario

  // 2. Crear Clínica Demo
  const clinic = await prisma.clinic.upsert({
    where: { id: 'clinic-demo-123' },
    update: {},
    create: {
      id: 'clinic-demo-123',
      name: 'Clínica Dental Deviaty',
      slug: 'deviaty-dental',
      timezone: 'America/Santiago',
      plan: 'PREMIUM',
      active: true,
    },
  });

  // 3. Crear Horarios
  for (let i = 1; i <= 5; i++) { // Lunes a Viernes
    await prisma.clinicSchedule.upsert({
      where: { clinicId_dayOfWeek: { clinicId: clinic.id, dayOfWeek: i } },
      update: {},
      create: {
        clinicId: clinic.id,
        dayOfWeek: i,
        openTime: '09:00',
        closeTime: '18:00',
        isOpen: true,
      },
    });
  }

  // 4. Crear Rol Admin
  const adminRole = await prisma.role.upsert({
    where: { name_clinicId: { name: 'Administrador', clinicId: clinic.id } },
    update: {},
    create: {
      clinicId: clinic.id,
      name: 'Administrador',
      isSuperadmin: false,
      permissions: {
         'users.view': true,
         'users.create': true,
         'clinic_config.edit': true,
         'conversations.view': true,
         'conversations.takeover': true,
         'metrics.view': true,
      },
    },
  });

  // 5. Crear Usuario Demo (Password: password123)
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'demo@deviaty.com' },
    update: {},
    create: {
      email: 'demo@deviaty.com',
      passwordHash,
      fullName: 'Operador Demo',
      clinicId: clinic.id,
      roleId: adminRole.id,
      active: true,
    },
  });

  // 6. Crear Tratamiento Inicial
  const treatment = await prisma.treatment.upsert({
    where: { id: 'treatment-limpieza' },
    update: {},
    create: {
      id: 'treatment-limpieza',
      clinicId: clinic.id,
      name: 'Limpieza Dental',
      description: 'Limpieza profunda con ultrasonido',
      durationAvgMin: 30,
      basePrice: 45000,
    },
  });

  // 7. Crear Doctor Inicial
  const doctor = await prisma.doctor.upsert({
    where: { id: 'doctor-smith' },
    update: {},
    create: {
      id: 'doctor-smith',
      clinicId: clinic.id,
      name: 'Dr. John Smith',
      specialty: 'Odontología General',
      active: true,
    },
  });

  // Vincular doctor a tratamiento
  await prisma.doctorTreatment.upsert({
    where: { doctorId_treatmentId: { doctorId: doctor.id, treatmentId: treatment.id } },
    update: {},
    create: {
      doctorId: doctor.id,
      treatmentId: treatment.id,
    },
  });

  // 8. Configuración Inicial del Agente
  await prisma.agentConfig.upsert({
    where: { clinicId: clinic.id },
    update: {},
    create: {
      clinicId: clinic.id,
      scheduling: { active: true, channels: ['WHATSAPP'], integrations: ['INTERNAL'] },
      encyclopedia: { active: true, channels: ['WHATSAPP'], integrations: ['INTERNAL'] },
      humanEscalation: { active: true, channels: ['WHATSAPP'], type: 'HUMAN_TAKEOVER' },
    },
  });

  console.log('✅ Seeding completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
