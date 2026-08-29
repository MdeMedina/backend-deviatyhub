import {
  Injectable,
  ConflictException,
  NotFoundException,
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

    // 2. Generar token de invitación
    const inviteToken = crypto.randomUUID();
    const inviteExpires = new Date();
    inviteExpires.setHours(inviteExpires.getHours() + 24); // 24 horas

    // 3. Crear usuario inactivo (sin password)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        clinicId,
        roleId: dto.roleId,
        inviteToken,
        inviteExpires,
        active: true,
      },
      include: { role: true },
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

