import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';
import { hashBcrypt } from '@deviaty/shared-utils';
import * as crypto from 'crypto';

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

  async invite(clinicId: string, dto: InviteUserDto) {
    this.logger.log(`invite - clinicId: ${clinicId}, email: ${dto.email}, roleId: ${dto.roleId}`);
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
    // 4. Publicar evento para el Notification Service
    await this.eventBus.publish(REDIS_CHANNELS.USER_INVITED, {
      userId: user.id,
      email: user.email,
      inviteToken: user.inviteToken,
      clinicId: user.clinicId,
    });

    return user;
  }

  async findAll(clinicId: string, page: number = 1, limit: number = 20) {
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

  async findOne(id: string, clinicId: string) {
    this.logger.log(`findOne - userId: ${id}, clinicId: ${clinicId}`);
    const user = await this.prisma.user.findFirst({
      where: { id, clinicId },
      include: { role: true },
    });
    if (!user) {
      this.logger.warn(`findOne - User: ${id} not found in clinicId: ${clinicId}`);
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async update(id: string, clinicId: string, dto: UpdateUserDto) {
    this.logger.log(`update - userId: ${id}, clinicId: ${clinicId}`);
    const { password, ...rest } = dto;
    const updateData: any = { ...rest };
    if (password) {
      updateData.passwordHash = await hashBcrypt(password);
    }
    return this.prisma.user.update({
      where: { id, clinicId },
      data: updateData,
      include: { role: true },
    });
  }

  async remove(id: string, clinicId: string) {
    this.logger.log(`remove - userId: ${id}, clinicId: ${clinicId}`);
    return this.prisma.user.update({
      where: { id, clinicId },
      data: { active: false },
    });
  }
}

