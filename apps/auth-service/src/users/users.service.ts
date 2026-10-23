import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';
import { hashBcrypt } from '@deviaty/shared-utils';
import * as crypto from 'crypto';
import { Actor, exigir, puede } from '../common/actor';
import { esAdminDePlataforma } from '../auth/auth.service';

/**
 * Lo que nunca sale en una respuesta. Antes el listado de usuarios devolvía
 * el hash de la contraseña y el token de invitación: con ese token cualquiera
 * de la clínica podía ponerle contraseña a una cuenta recién invitada.
 */
const OCULTOS = { passwordHash: true, inviteToken: true } as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject('EVENT_BUS')
    private readonly eventBus: EventBus,
  ) {
    this.logger.log('UsersService initialized');
  }

  /**
   * Rol con el que entra un profesional: ve y edita SU jornada y consulta SU
   * agenda, nada más. Se crea la primera vez que se invita a alguien, para no
   * depender de que exista un seed que en producción no se ejecuta.
   */
  private async ensureDoctorRole(clinicId: string): Promise<string> {
    const existente = await this.prisma.role.findFirst({
      where: { clinicId, name: 'Doctor' },
    });
    if (existente) return existente.id;

    const creado = await this.prisma.role.create({
      data: {
        clinicId,
        name: 'Doctor',
        isSuperadmin: false,
        permissions: {
          users: { view: false, create: false, edit: false, delete: false },
          agenda: { view: true, edit: false },
          own_schedule: { view: true, edit: true },
          metrics: { view: false },
          security: { view: false },
          simulator: { view: false },
          integrations: { view: false },
          agent_actions: { view: false, edit: false },
          clinic_config: { view: false, edit: false },
          conversations: { view: false, takeover: false },
          knowledge_base: { view: false, edit: false },
        },
      },
    });
    this.logger.log(`Rol Doctor creado para la clínica ${clinicId}: ${creado.id}`);
    return creado.id;
  }

  /**
   * El rol tiene que ser de esta clínica (antes se aceptaba cualquier id, de
   * cualquier clínica), y el de administrador solo lo da otro administrador.
   */
  private async comprobarRolAsignable(actor: Actor, clinicId: string, roleId: string) {
    const rol = await this.prisma.role.findFirst({ where: { id: roleId, clinicId } });
    if (!rol) {
      throw new BadRequestException('Ese rol no existe en la clínica.');
    }
    if (rol.isSuperadmin && !actor.admin) {
      throw new ForbiddenException('Solo un administrador puede dar el rol de administrador.');
    }
  }

  /** Un correo de PLATFORM_ADMIN_EMAILS da acceso al backoffice: no se reparte. */
  private comprobarCorreo(actor: Actor, email: string) {
    if (esAdminDePlataforma({ email }) && !actor.plataforma) {
      throw new ForbiddenException('Ese correo está reservado para el equipo de la plataforma.');
    }
  }

  /** A un administrador (o a alguien de la plataforma) solo lo toca otro igual. */
  private comprobarObjetivo(
    actor: Actor,
    objetivo: { email: string; platformAdmin?: boolean | null; role?: { isSuperadmin: boolean | null } | null },
  ) {
    if (esAdminDePlataforma(objetivo) && !actor.plataforma) {
      throw new ForbiddenException('No puedes modificar una cuenta del equipo de la plataforma.');
    }
    if (objetivo.role?.isSuperadmin && !actor.admin) {
      throw new ForbiddenException('Solo un administrador puede modificar a otro administrador.');
    }
  }

  async invite(clinicId: string, actor: Actor, dto: InviteUserDto) {
    this.logger.log(`invite - clinicId: ${clinicId}, email: ${dto.email}, roleId: ${dto.roleId}`);
    exigir(actor, 'users.create', 'users.edit');
    this.comprobarCorreo(actor, dto.email);
    if (dto.roleId) {
      await this.comprobarRolAsignable(actor, clinicId, dto.roleId);
    }

    // 1. Verificar si ya existe
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      this.logger.warn(`invite - User email: ${dto.email} is already registered`);
      throw new ConflictException('El correo ya está registrado');
    }

    // 1.b Si la invitación es para un profesional, la ficha tiene que existir,
    //     ser de esta clínica y no tener ya una cuenta enlazada.
    let doctor: { id: string; name: string } | null = null;
    if (dto.doctorId) {
      const ficha = await this.prisma.doctor.findFirst({
        where: { id: dto.doctorId, clinicId },
        select: { id: true, name: true, userId: true },
      });
      if (!ficha) {
        throw new NotFoundException('No existe esa ficha de profesional en la clínica.');
      }
      if (ficha.userId) {
        throw new ConflictException(`${ficha.name} ya tiene una cuenta enlazada.`);
      }
      doctor = { id: ficha.id, name: ficha.name };
    }

    const roleId = dto.roleId ?? (dto.doctorId ? await this.ensureDoctorRole(clinicId) : undefined);
    if (!roleId) {
      throw new BadRequestException('Falta el rol para la invitación.');
    }

    // 2. Generar token de invitación
    const inviteToken = crypto.randomUUID();
    const inviteExpires = new Date();
    inviteExpires.setHours(inviteExpires.getHours() + 24); // 24 horas

    // 3. Crear usuario inactivo (sin password) y, si toca, enlazarlo con su
    //    ficha. Va en una transacción: una cuenta creada sin enlazar dejaría a
    //    esa persona dentro de la plataforma sin jornada que gestionar.
    const user = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.user.create({
        data: {
          email: dto.email,
          clinicId,
          roleId,
          inviteToken,
          inviteExpires,
          active: true,
        },
        include: { role: true },
        omit: OCULTOS,
      });

      if (doctor) {
        await tx.doctor.update({
          where: { id: doctor.id },
          data: { userId: creado.id },
        });
        this.logger.log(`Cuenta ${creado.id} enlazada con el profesional ${doctor.name}.`);
      }

      return creado;
    });

    this.logger.log(`invite - User: ${user.id} created, publishing USER_INVITED event`);
    // 4. Publicar evento para el Notification Service. El token va solo por
    //    correo: la respuesta ya no lo incluye.
    await this.eventBus.publish(REDIS_CHANNELS.USER_INVITED, {
      userId: user.id,
      email: user.email,
      inviteToken,
      clinicId: user.clinicId,
    });

    return user;
  }

  async findAll(clinicId: string, actor: Actor, page: number = 1, limit: number = 20) {
    exigir(actor, 'users.view');
    let activePage = Number(page);
    let activeLimit = Number(limit);

    if (isNaN(activePage) || activePage < 1) {
      activePage = 1;
    }
    if (isNaN(activeLimit) || activeLimit < 1) {
      activeLimit = 20;
    }

    this.logger.log(`findAll - clinicId: ${clinicId}, page: ${activePage}, limit: ${activeLimit}`);
    const skip = (activePage - 1) * activeLimit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { clinicId },
        include: { role: true },
        omit: OCULTOS,
        skip,
        take: activeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { clinicId } }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, clinicId: string, actor: Actor) {
    this.logger.log(`findOne - userId: ${id}, clinicId: ${clinicId}`);
    if (id !== actor.id) exigir(actor, 'users.view');
    const user = await this.prisma.user.findFirst({
      where: { id, clinicId },
      include: { role: true },
      omit: OCULTOS,
    });
    if (!user) {
      this.logger.warn(`findOne - User: ${id} not found in clinicId: ${clinicId}`);
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  /**
   * Cambiar el rol, el correo, la contraseña o el estado de otra persona pide
   * users.edit. Antes bastaba con tener sesión en la clínica: un doctor podía
   * cambiarle la contraseña al dueño. Cada uno puede cambiar SU contraseña,
   * pero no su rol.
   */
  async update(id: string, clinicId: string, actor: Actor, dto: UpdateUserDto) {
    this.logger.log(`update - userId: ${id}, clinicId: ${clinicId}`);
    const objetivo = await this.prisma.user.findFirst({
      where: { id, clinicId },
      include: { role: true },
    });
    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const propio = objetivo.id === actor.id;
    const cambiaRol = dto.roleId !== undefined && dto.roleId !== objetivo.roleId;
    const cambiaCorreo = dto.email !== undefined && dto.email !== objetivo.email;
    const cambiaEstado = dto.active !== undefined && dto.active !== objetivo.active;

    if (!puede(actor, 'users.edit')) {
      // Sin permiso de gestión, solo la contraseña propia.
      if (!propio || cambiaRol || cambiaCorreo || cambiaEstado) {
        throw new ForbiddenException('No tienes permiso para realizar esta acción');
      }
    }
    if (propio && cambiaRol) {
      throw new ForbiddenException('No puedes cambiar tu propio rol.');
    }
    if (propio && dto.active === false) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta.');
    }
    if (!propio) this.comprobarObjetivo(actor, objetivo);
    if (cambiaRol) await this.comprobarRolAsignable(actor, clinicId, dto.roleId!);
    if (cambiaCorreo) this.comprobarCorreo(actor, dto.email!);

    const { password, ...rest } = dto;
    const updateData: any = { ...rest };
    if (password) {
      updateData.passwordHash = await hashBcrypt(password);
    }
    return this.prisma.user.update({
      where: { id, clinicId },
      data: updateData,
      include: { role: true },
      omit: OCULTOS,
    });
  }

  async remove(id: string, clinicId: string, actor: Actor) {
    this.logger.log(`remove - userId: ${id}, clinicId: ${clinicId}`);
    exigir(actor, 'users.delete');
    const objetivo = await this.prisma.user.findFirst({
      where: { id, clinicId },
      include: { role: true },
    });
    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (objetivo.id === actor.id) {
      throw new BadRequestException('No puedes quitar tu propia cuenta.');
    }
    this.comprobarObjetivo(actor, objetivo);

    // Se desactiva (no se borra: queda su rastro en conversaciones y auditoría)
    // y se anula la invitación: si no, el enlace seguía sirviendo para crear
    // una contraseña en una cuenta que ya se había quitado.
    return this.prisma.user.update({
      where: { id, clinicId },
      data: { active: false, inviteToken: null, inviteExpires: null },
      omit: OCULTOS,
    });
  }
}
