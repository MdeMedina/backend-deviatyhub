import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { EventBus, REDIS_CHANNELS } from '@deviaty/shared-events';
import { randomUUID } from 'crypto';
import { subDays } from 'date-fns';
import { CreateClinicDto, InviteClinicUserDto, UpdateAccessDto, UpdateClinicDto } from './dto/platform.dto';
import {
  ACCIONES_AGENTE,
  CANALES_AGENTE,
  MODULOS_CLINICA,
  agenteHabilitado,
  modulosDeClinica,
} from '@deviaty/shared-utils';

/**
 * Los accesos de una clínica, completos: cada clave con su valor. Canales,
 * acciones y recordatorios se muestran por sí mismos, aparte del interruptor
 * general del agente, para que al reencenderlo vuelva todo como estaba.
 */
export function accesosCompletos(entitlements: unknown) {
  const agente = ((entitlements as any)?.agent || {}) as Record<string, any>;
  return {
    modules: modulosDeClinica(entitlements),
    agent: {
      enabled: agenteHabilitado(entitlements),
      channels: Object.fromEntries(CANALES_AGENTE.map((c) => [c, agente.channels?.[c] !== false])),
      actions: Object.fromEntries(ACCIONES_AGENTE.map((a) => [a, agente.actions?.[a] !== false])),
      reminders: agente.reminders !== false,
    },
  };
}

/** Solo booleanos y solo claves conocidas: lo demás se descarta. */
function soloClaves(origen: unknown, claves: readonly string[]): Record<string, boolean> {
  const salida: Record<string, boolean> = {};
  if (!origen || typeof origen !== 'object') return salida;
  for (const k of claves) {
    const v = (origen as Record<string, unknown>)[k];
    if (typeof v === 'boolean') salida[k] = v;
  }
  return salida;
}

/** Días que dura una invitación del alta. Una clínica nueva no siempre la abre el mismo día. */
const DIAS_INVITACION = 7;

/** Mismos permisos que el rol del dueño en el seed. */
const PERMISOS_DUENO = {
  all: true,
  users: ['create', 'read', 'update', 'delete'],
  clinic: ['update'],
  doctors: ['create', 'read', 'update', 'delete'],
};

/** Horario de partida: lunes a viernes de 9 a 18. La clínica lo ajusta en su panel. */
const HORARIO_INICIAL = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dayOfWeek: dia,
  openTime: '09:00',
  closeTime: '18:00',
  isOpen: dia >= 1 && dia <= 5,
}));

export function slugDe(nombre: string): string {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  private readonly frontendUrl = process.env.FRONTEND_URL || 'https://app.dentral.cl';

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventBus) private readonly eventBus: EventBus,
  ) {}

  /** Todas las clínicas con lo necesario para ver de un vistazo cómo está cada una. */
  async listClinics() {
    const hace30 = subDays(new Date(), 30);

    const [clinicas, usuarios, profesionales, conversaciones, citasAgente, ultimaActividad, whatsapp] =
      await Promise.all([
        this.prisma.clinic.findMany({
          where: { internal: false },
          orderBy: { createdAt: 'asc' },
          include: { agentConfig: { select: { mode: true } } },
        }),
        this.prisma.user.groupBy({ by: ['clinicId'], _count: { _all: true } }),
        this.prisma.doctor.groupBy({ by: ['clinicId'], where: { active: true }, _count: { _all: true } }),
        this.prisma.conversation.groupBy({
          by: ['clinicId'],
          where: { startedAt: { gte: hace30 } },
          _count: { _all: true },
        }),
        this.prisma.appointment.groupBy({
          by: ['clinicId'],
          where: { source: 'AGENT', createdAt: { gte: hace30 } },
          _count: { _all: true },
        }),
        this.prisma.message.groupBy({ by: ['clinicId'], _max: { sentAt: true } }),
        this.prisma.clinicIntegration.findMany({
          where: { type: 'WHATSAPP' },
          select: { clinicId: true, connected: true, externalId: true, credentials: true },
        }),
      ]);

    const contar = (filas: any[]) => new Map(filas.map((f) => [f.clinicId, f._count._all]));
    const nUsuarios = contar(usuarios);
    const nProfesionales = contar(profesionales);
    const nConversaciones = contar(conversaciones);
    const nCitasAgente = contar(citasAgente);
    const ultima = new Map(ultimaActividad.map((f) => [f.clinicId, f._max.sentAt]));
    const wa = new Map(whatsapp.map((w) => [w.clinicId, w]));

    return clinicas.map((c) => {
      const integracion = wa.get(c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        plan: c.plan,
        active: c.active !== false,
        billing_email: c.billingEmail,
        created_at: c.createdAt,
        agent_mode: c.agentConfig?.mode ?? null,
        users: nUsuarios.get(c.id) ?? 0,
        doctors: nProfesionales.get(c.id) ?? 0,
        conversations_30d: nConversaciones.get(c.id) ?? 0,
        agent_appointments_30d: nCitasAgente.get(c.id) ?? 0,
        last_activity_at: ultima.get(c.id) ?? null,
        whatsapp: {
          configured: Boolean((integracion?.credentials as any)?.encrypted_data),
          connected: integracion?.connected === true,
          phone_number_id: integracion?.externalId ?? null,
        },
      };
    });
  }

  async getClinic(id: string) {
    const clinica = await this.prisma.clinic.findFirst({
      where: { id, internal: false },
      include: {
        configs: true,
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        agentConfig: true,
        integrations: {
          select: { type: true, connected: true, lastTestedAt: true, lastTestOk: true, externalId: true, credentials: true },
        },
        users: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            email: true,
            active: true,
            createdAt: true,
            passwordHash: true,
            inviteExpires: true,
            platformAdmin: true,
            role: { select: { name: true, isSuperadmin: true } },
            doctor: { select: { name: true } },
          },
        },
      },
    });
    if (!clinica) throw new NotFoundException('No existe esa clínica.');

    const [profesionales, tratamientos, contactos] = await Promise.all([
      this.prisma.doctor.count({ where: { clinicId: id, active: true } }),
      this.prisma.treatment.count({ where: { clinicId: id, active: true } }),
      this.prisma.clinicContact.count({ where: { clinicId: id } }),
    ]);

    return {
      id: clinica.id,
      name: clinica.name,
      slug: clinica.slug,
      plan: clinica.plan,
      active: clinica.active !== false,
      billing_email: clinica.billingEmail,
      created_at: clinica.createdAt,
      config: clinica.configs,
      schedules: clinica.schedules,
      agent_mode: clinica.agentConfig?.mode ?? null,
      // Lo que la plataforma le habilita. La entrada a la plataforma es `active`.
      access: accesosCompletos(clinica.entitlements),
      counts: { doctors: profesionales, treatments: tratamientos, contacts: contactos },
      // Nunca se devuelven las credenciales: solo si están y si funcionan.
      integrations: clinica.integrations.map((i) => ({
        type: i.type,
        configured: Boolean((i.credentials as any)?.encrypted_data),
        connected: i.connected === true,
        last_tested_at: i.lastTestedAt,
        last_test_ok: i.lastTestOk,
        external_id: i.externalId,
      })),
      users: clinica.users.map((u) => ({
        id: u.id,
        email: u.email,
        active: u.active !== false,
        role: u.role?.name,
        is_owner: u.role?.isSuperadmin === true,
        doctor: u.doctor?.name ?? null,
        platform_admin: u.platformAdmin,
        created_at: u.createdAt,
        // Sin contraseña todavía: la invitación sigue pendiente.
        invite_pending: !u.passwordHash,
        invite_expires: u.passwordHash ? null : u.inviteExpires,
      })),
    };
  }

  /**
   * Alta de una clínica: queda creada, con su dueña invitada y el agente en
   * pausa. En pausa porque una clínica recién creada no tiene profesionales,
   * tratamientos ni WhatsApp: un agente autónomo contestaría con una agenda
   * vacía. Se activa desde su panel cuando está lista.
   */
  async createClinic(dto: CreateClinicDto) {
    const nombre = dto.name.trim();
    const slug = dto.slug || slugDe(nombre);
    if (!slug) throw new BadRequestException('No se pudo derivar un identificador del nombre.');
    const adminEmail = dto.adminEmail.trim().toLowerCase();

    const [slugUsado, correoUsado] = await Promise.all([
      this.prisma.clinic.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } }),
    ]);
    if (slugUsado) throw new ConflictException(`Ya hay una clínica con el identificador "${slug}".`);
    if (correoUsado) throw new ConflictException(`El correo ${adminEmail} ya tiene una cuenta en la plataforma.`);

    const inviteToken = randomUUID();
    const inviteExpires = new Date(Date.now() + DIAS_INVITACION * 24 * 60 * 60 * 1000);

    const { clinica, admin } = await this.prisma.$transaction(async (tx) => {
      const clinica = await tx.clinic.create({
        data: { name: nombre, slug, plan: dto.plan ?? 'STARTER', billingEmail: dto.billingEmail.trim().toLowerCase() },
      });
      await tx.clinicConfig.create({
        data: {
          clinicId: clinica.id,
          name: nombre,
          address: dto.address?.trim() || '',
          phone: dto.phone?.trim() || '',
          email: dto.billingEmail.trim().toLowerCase(),
          timezone: dto.timezone || process.env.CLINIC_TIMEZONE || 'America/Santiago',
        },
      });
      await tx.clinicSchedule.createMany({ data: HORARIO_INICIAL.map((h) => ({ ...h, clinicId: clinica.id })) });
      await tx.agentConfig.create({ data: { clinicId: clinica.id, mode: 'PAUSED' } });
      const rol = await tx.role.create({
        data: { clinicId: clinica.id, name: 'Administrador', isSuperadmin: true, permissions: PERMISOS_DUENO },
      });
      const admin = await tx.user.create({
        data: { email: adminEmail, clinicId: clinica.id, roleId: rol.id, inviteToken, inviteExpires, active: true },
      });
      return { clinica, admin };
    });

    this.logger.log(`Clínica creada: ${clinica.name} (${clinica.id}); dueña invitada: ${admin.email}.`);
    await this.publicarInvitacion(admin.id, admin.email, clinica.id, inviteToken);

    return {
      clinic: { id: clinica.id, name: clinica.name, slug: clinica.slug },
      admin: { id: admin.id, email: admin.email },
      // Para copiarlo y mandarlo a mano si el correo no llega.
      invite_link: this.enlaceInvitacion(inviteToken),
      invite_expires: inviteExpires,
    };
  }

  async updateClinic(id: string, dto: UpdateClinicDto) {
    const existe = await this.prisma.clinic.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('No existe esa clínica.');
    await this.prisma.clinic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.plan !== undefined ? { plan: dto.plan } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.billingEmail !== undefined ? { billingEmail: dto.billingEmail.trim().toLowerCase() } : {}),
      },
    });
    return this.getClinic(id);
  }

  /**
   * Cambia los accesos de la clínica. Se fusiona con lo que había: lo que no
   * viene en la petición no cambia.
   */
  async updateAccess(id: string, dto: UpdateAccessDto) {
    const clinica = await this.prisma.clinic.findUnique({ where: { id }, select: { entitlements: true } });
    if (!clinica) throw new NotFoundException('No existe esa clínica.');
    const actual = (clinica.entitlements as any) || {};

    const agente = dto.agent || {};
    const nuevo = {
      ...actual,
      modules: { ...(actual.modules || {}), ...soloClaves(dto.modules, MODULOS_CLINICA) },
      agent: {
        ...(actual.agent || {}),
        ...soloClaves(agente, ['enabled', 'reminders']),
        channels: { ...(actual.agent?.channels || {}), ...soloClaves(agente.channels, CANALES_AGENTE) },
        actions: { ...(actual.agent?.actions || {}), ...soloClaves(agente.actions, ACCIONES_AGENTE) },
      },
    };

    await this.prisma.clinic.update({ where: { id }, data: { entitlements: nuevo } });
    this.logger.log(`Accesos de la clínica ${id} actualizados: ${JSON.stringify(nuevo)}`);
    return this.getClinic(id);
  }

  /**
   * Invita a un administrador más a la clínica, con el rol de dueño. Las demás
   * personas las invita la propia clínica desde su panel, con sus roles.
   */
  async inviteAdmin(clinicId: string, dto: InviteClinicUserDto) {
    const email = dto.email.trim().toLowerCase();
    const [rol, existente] = await Promise.all([
      this.prisma.role.findFirst({ where: { clinicId, isSuperadmin: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (!rol) throw new NotFoundException('La clínica no tiene rol de administrador.');
    if (existente) throw new ConflictException(`El correo ${email} ya tiene una cuenta en la plataforma.`);

    const inviteToken = randomUUID();
    const inviteExpires = new Date(Date.now() + DIAS_INVITACION * 24 * 60 * 60 * 1000);
    const usuario = await this.prisma.user.create({
      data: { email, clinicId, roleId: rol.id, inviteToken, inviteExpires, active: true },
    });
    await this.publicarInvitacion(usuario.id, email, clinicId, inviteToken);
    return { user: { id: usuario.id, email }, invite_link: this.enlaceInvitacion(inviteToken), invite_expires: inviteExpires };
  }

  /** Nueva invitación para quien todavía no ha puesto contraseña. */
  async resendInvite(clinicId: string, userId: string) {
    const usuario = await this.prisma.user.findFirst({ where: { id: userId, clinicId } });
    if (!usuario) throw new NotFoundException('Ese usuario no es de esta clínica.');
    if (usuario.passwordHash) throw new BadRequestException('Esa cuenta ya está activa: no necesita invitación.');

    const inviteToken = randomUUID();
    const inviteExpires = new Date(Date.now() + DIAS_INVITACION * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({ where: { id: userId }, data: { inviteToken, inviteExpires } });
    await this.publicarInvitacion(usuario.id, usuario.email, clinicId, inviteToken);

    return { invite_link: this.enlaceInvitacion(inviteToken), invite_expires: inviteExpires };
  }

  /** Totales de toda la plataforma. */
  async overview() {
    const ahora = new Date();
    const hace7 = subDays(ahora, 7);
    const hace30 = subDays(ahora, 30);

    const [clinicas, activas, conversaciones30, mensajesEntrantes7, citasAgente30, derivaciones30] = await Promise.all([
      this.prisma.clinic.count({ where: { internal: false } }),
      this.prisma.clinic.count({ where: { internal: false, active: { not: false } } }),
      this.prisma.conversation.count({ where: { startedAt: { gte: hace30 } } }),
      this.prisma.message.count({ where: { role: 'USER', sentAt: { gte: hace7 } } }),
      this.prisma.appointment.count({ where: { source: 'AGENT', createdAt: { gte: hace30 } } }),
      this.prisma.conversation.count({ where: { status: 'HUMAN_TAKEOVER', startedAt: { gte: hace30 } } }),
    ]);

    return {
      clinics: clinicas,
      active_clinics: activas,
      conversations_30d: conversaciones30,
      inbound_messages_7d: mensajesEntrantes7,
      agent_appointments_30d: citasAgente30,
      human_takeovers_30d: derivaciones30,
    };
  }

  // ─── Equipo de la plataforma ─────────────────────────────────────────

  /** Correos con acceso de superusuario fijado en el servidor (PLATFORM_ADMIN_EMAILS). */
  private correosDelServidor(): string[] {
    return String(process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  async listTeam(usuarioActual?: string) {
    const delServidor = this.correosDelServidor();
    const miembros = await this.prisma.user.findMany({
      where: { OR: [{ platformAdmin: true }, { email: { in: delServidor } }] },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        active: true,
        platformAdmin: true,
        passwordHash: true,
        inviteExpires: true,
        createdAt: true,
        clinic: { select: { name: true, internal: true } },
      },
    });
    return miembros.map((u) => ({
      id: u.id,
      email: u.email,
      active: u.active !== false,
      is_you: u.id === usuarioActual,
      // De dónde le viene el acceso: lo dado en el backoffice se puede quitar
      // desde aquí; lo del servidor, solo cambiando el .env.
      from_server: delServidor.includes(u.email.toLowerCase()),
      from_backoffice: u.platformAdmin,
      // Si su cuenta vive en una clínica de verdad, también trabaja en ella.
      clinic: u.clinic?.internal ? null : u.clinic?.name ?? null,
      invite_pending: !u.passwordHash,
      invite_expires: u.passwordHash ? null : u.inviteExpires,
      created_at: u.createdAt,
    }));
  }

  /**
   * Da acceso de superusuario. Si el correo ya tiene cuenta (p. ej. en una
   * clínica) se le añade el acceso sin más; si no, se crea su cuenta en la
   * clínica interna y se le invita.
   */
  async inviteTeamMember(emailCrudo: string) {
    const email = emailCrudo.trim().toLowerCase();
    const existente = await this.prisma.user.findUnique({ where: { email } });
    if (existente) {
      if (existente.platformAdmin) throw new ConflictException(`${email} ya es parte del equipo.`);
      await this.prisma.user.update({ where: { id: existente.id }, data: { platformAdmin: true } });
      this.logger.log(`Acceso de superusuario dado a una cuenta existente: ${email}.`);
      return { email, promoted: true, invite_link: null, invite_expires: null };
    }

    const { clinicId, roleId } = await this.clinicaInterna();
    const inviteToken = randomUUID();
    const inviteExpires = new Date(Date.now() + DIAS_INVITACION * 24 * 60 * 60 * 1000);
    const usuario = await this.prisma.user.create({
      data: { email, clinicId, roleId, inviteToken, inviteExpires, active: true, platformAdmin: true },
    });
    await this.publicarInvitacion(usuario.id, email, clinicId, inviteToken);
    this.logger.log(`Superusuario invitado: ${email}.`);
    return { email, promoted: false, invite_link: this.enlaceInvitacion(inviteToken), invite_expires: inviteExpires };
  }

  async revokeTeamMember(userId: string, usuarioActual?: string) {
    if (userId === usuarioActual) {
      throw new BadRequestException('No puedes quitarte el acceso a ti mismo.');
    }
    const usuario = await this.prisma.user.findUnique({ where: { id: userId }, include: { clinic: true } });
    if (!usuario) throw new NotFoundException('No existe ese usuario.');
    if (this.correosDelServidor().includes(usuario.email.toLowerCase())) {
      throw new BadRequestException(
        `${usuario.email} tiene el acceso fijado en el servidor (PLATFORM_ADMIN_EMAILS). Se quita desde ahí.`,
      );
    }
    // Una cuenta de la clínica interna no tiene nada más que hacer en la
    // plataforma: sin el acceso se desactiva. Una de clínica de verdad sigue
    // trabajando en su clínica.
    await this.prisma.user.update({
      where: { id: userId },
      data: { platformAdmin: false, ...(usuario.clinic?.internal ? { active: false } : {}) },
    });
    this.logger.log(`Acceso de superusuario quitado a ${usuario.email}.`);
    return this.listTeam(usuarioActual);
  }

  /** Nueva invitación para un superusuario que todavía no ha puesto contraseña. */
  async resendTeamInvite(userId: string) {
    const usuario = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!usuario || !(usuario.platformAdmin || this.correosDelServidor().includes(usuario.email.toLowerCase()))) {
      throw new NotFoundException('Ese usuario no es parte del equipo.');
    }
    return this.resendInvite(usuario.clinicId, usuario.id);
  }

  /** La clínica interna y su rol, creados la primera vez que hacen falta. */
  private async clinicaInterna(): Promise<{ clinicId: string; roleId: string }> {
    let clinica = await this.prisma.clinic.findFirst({ where: { internal: true }, orderBy: { createdAt: 'asc' } });
    if (!clinica) {
      clinica = await this.prisma.clinic.create({
        data: {
          name: 'Dentral (plataforma)',
          slug: 'dentral-plataforma',
          internal: true,
          billingEmail: 'equipo@dentral.cl',
          // Sin agente: aquí no hay pacientes.
          entitlements: { agent: { enabled: false } },
        },
      });
      this.logger.log(`Clínica interna de la plataforma creada: ${clinica.id}.`);
    }
    let rol = await this.prisma.role.findFirst({ where: { clinicId: clinica.id, name: 'Equipo Dentral' } });
    if (!rol) {
      rol = await this.prisma.role.create({
        data: { clinicId: clinica.id, name: 'Equipo Dentral', isSuperadmin: false, permissions: {} },
      });
    }
    return { clinicId: clinica.id, roleId: rol.id };
  }

  private enlaceInvitacion(token: string) {
    return `${this.frontendUrl}/set-password?token=${token}`;
  }

  private async publicarInvitacion(userId: string, email: string, clinicId: string, inviteToken: string) {
    await this.eventBus
      .publish(REDIS_CHANNELS.USER_INVITED, { userId, email, clinicId, inviteToken, token: inviteToken })
      .catch((e: Error) => this.logger.warn(`No se pudo publicar la invitación de ${email}: ${e.message}`));
  }
}
