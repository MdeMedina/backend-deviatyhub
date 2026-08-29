import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seeding con hash compatible...');

  // 1. Crear Clínica
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
        }
      }
    }
  });

  // 2. Crear Rol Superadmin
  // Buscamos si ya existe para no duplicar
  let superadminRole = await prisma.role.findFirst({
    where: { clinicId: clinic.id, name: 'Superadmin' }
  });

  if (!superadminRole) {
    superadminRole = await prisma.role.create({
      data: {
        clinicId: clinic.id,
        name: 'Superadmin',
        isSuperadmin: true,
        permissions: {
          all: true,
          users: ['create', 'read', 'update', 'delete'],
          clinic: ['update'],
          doctors: ['create', 'read', 'update', 'delete'],
        }
      }
    });
  }

  // 3. Crear Usuario de Prueba
  // Generamos el hash dinámicamente con bcryptjs
  const password = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.upsert({
    where: { email: 'mamedina770@gmail.com' },
    update: {
      passwordHash: passwordHash,
      roleId: superadminRole.id,
      clinicId: clinic.id,
    },
    create: {
      email: 'mamedina770@gmail.com',
      passwordHash: passwordHash,
      clinicId: clinic.id,
      roleId: superadminRole.id,
      active: true,
    }
  });

  console.log(`✅ Usuario creado/actualizado: ${user.email}`);
  console.log(`🔑 Contraseña: ${password}`);

  // 4. Crear Doctores (usando upsert para evitar duplicados si se corre varias veces)
  const doctors = [
    { name: 'Dr. Miguel Medina', title: 'Odontólogo General' },
    { name: 'Dra. Ana López', title: 'Ortodoncista' },
  ];

  for (const doc of doctors) {
    await prisma.doctor.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' }, // ID ficticio para el primer doc o simplemente usar create
      update: doc,
      create: { ...doc, clinicId: clinic.id }
    }).catch(() => prisma.doctor.create({ data: { ...doc, clinicId: clinic.id } }));
  }

  console.log('✅ Datos de prueba listos');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
