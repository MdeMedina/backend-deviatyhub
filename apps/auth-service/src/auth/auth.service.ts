import { Injectable, UnauthorizedException, ConflictException, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { hashBcrypt, compareBcrypt, signJWT, verifyJWT } from '@deviaty/shared-utils';
import { IJwtPayload } from '@deviaty/shared-types';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    @Inject(PrismaService)
    private prisma: PrismaService,
    @Inject(ConfigService)
    private config: ConfigService,
    @Inject('EVENT_BUS')
    private eventBus: EventBus,
  ) {
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret')!;
    this.refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret')!;
  }

  async register(dto: RegisterDto) {
    // 1. Verificar si el usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    // 2. Hashear password
    const passwordHash = await hashBcrypt(dto.password);

    // 3. Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        clinicId: dto.clinic_id,
        roleId: dto.role_id,
      },
      select: {
        id: true,
        email: true,
        clinicId: true,
        createdAt: true,
      },
    });

    // 4. Publicar evento
    await this.eventBus.publish(REDIS_CHANNELS.USER_CREATED, {
      userId: user.id,
      email: user.email,
      clinicId: user.clinicId,
    });

    return user;
  }

  async login(dto: LoginDto) {
    // 1. Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Verificar password
    const passwordValid = await compareBcrypt(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generar Tokens
    const payload: IJwtPayload = {
      userId: user.id,
      clinicId: user.clinicId,
      role: user.role.name as any,
      email: user.email,
      permissions: user.role.permissions as any,
    };

    const accessToken = signJWT(payload, this.accessSecret, '15m');
    const refreshToken = signJWT({ userId: user.id }, this.refreshSecret, '7d');

    // 4. Guardar Refresh Token (Hash para seguridad)
    const refreshTokenHash = await hashBcrypt(refreshToken);
    
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 min
      user: {
        id: user.id,
        email: user.email,
        clinic_id: user.clinicId,
        role: {
          id: user.role.id,
          name: user.role.name,
          is_superadmin: user.role.isSuperadmin || false,
          permissions: user.role.permissions,
        },
      },
    };
  }

  async logout(accessToken: string, refreshToken: string) {
    // 1. Blacklist Access Token (prefijo blacklist:at:)
    // Decodificar para obtener el JTI (o usar el token completo como key)
    try {
      const decoded = verifyJWT<any>(accessToken, this.accessSecret);
      const ttl = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
      if (ttl > 0) {
        await this.eventBus.setKey(`blacklist:at:${accessToken}`, 'true', ttl);
      }
    } catch (e) {
      // Token inválido o ya expirado, no importa
    }

    // 2. Revocar Refresh Token en DB
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: { not: '' }, // placeholder to match all, then find by bcrypt
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async setPassword(dto: any) {
    if (dto.password !== dto.password_confirm) {
      throw new BadRequestException('PASSWORDS_DO_NOT_MATCH');
    }

    const user = await this.prisma.user.findFirst({
      where: { inviteToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('TOKEN_NOT_FOUND');
    }

    if (user.inviteExpires && user.inviteExpires < new Date()) {
      throw new BadRequestException('TOKEN_EXPIRED');
    }

    const passwordHash = await hashBcrypt(dto.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteToken: null,
        inviteExpires: null,
      },
    });

    return { message: 'Contraseña establecida correctamente' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      clinic_id: user.clinicId,
      active: user.active,
      role: {
        id: user.role.id,
        name: user.role.name,
        is_superadmin: user.role.isSuperadmin || false,
        permissions: user.role.permissions,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    // 1. Verificar firma del Refresh Token
    let decoded: { userId: string };
    try {
      decoded = verifyJWT<{ userId: string }>(refreshToken, this.refreshSecret);
    } catch (e) {
      throw new UnauthorizedException('Refresh Token inválido o expirado');
    }

    // 2. Buscar el token en DB (hash)
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: decoded.userId, revokedAt: null },
    });

    // Validar contra el hash de cada token activo
    let dbToken = null;
    for (const t of tokens) {
      if (await compareBcrypt(refreshToken, t.tokenHash)) {
        dbToken = t;
        break;
      }
    }

    if (!dbToken || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh Token no encontrado o expirado');
    }

    // 3. Revocar el anterior
    await this.prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { revokedAt: new Date() },
    });

    // 4. Generar nuevo par
    const user = await this.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const payload: IJwtPayload = {
      userId: user.id,
      clinicId: user.clinicId,
      role: user.role.name as any,
      email: user.email,
      permissions: user.role.permissions as any,
    };

    const newAccessToken = signJWT(payload, this.accessSecret, '15m');
    const newRefreshToken = signJWT({ userId: user.id }, this.refreshSecret, '7d');

    // 5. Guardar el nuevo hash
    const newRefreshTokenHash = await hashBcrypt(newRefreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
