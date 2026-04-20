import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject('EVENT_BUS')
    private readonly eventBus: EventBus,
  ) {}

  async invite(clinicId: string, dto: InviteUserDto) {
    // 1. Verificar si ya existe
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
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

    // 4. Publicar evento para el Notification Service
    await this.eventBus.publish(REDIS_CHANNELS.USER_INVITED, {
      userId: user.id,
      email: user.email,
      inviteToken: user.inviteToken,
      clinicId: user.clinicId,
    });

    return user;
  }

  async findAll(clinicId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { clinicId },
        include: { role: true },
        skip,
        take: Number(limit),
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
    const user = await this.prisma.user.findFirst({
      where: { id, clinicId },
      include: { role: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: string, clinicId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id, clinicId },
      data: dto,
      include: { role: true },
    });
  }

  async remove(id: string, clinicId: string) {
    return this.prisma.user.update({
      where: { id, clinicId },
      data: { active: false },
    });
  }
}
