import { Injectable, UnauthorizedException, ConflictException, Inject, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { hashBcrypt, compareBcrypt, signJWT, verifyJWT, recortarPermisos, modulosDeClinica } from '@deviaty/shared-utils';
import { IJwtPayload } from '@deviaty/shared-types';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';

/**
 * Superusuario de la plataforma: marcado en la base de datos o con su correo en
 * PLATFORM_ADMIN_EMAILS (separados por coma). La lista evita tener que tocar la
 * base de producción a mano para dar o quitar el acceso al backoffice.
 */
export function esAdminDePlataforma(user: { email: string; platformAdmin?: boolean | null }): boolean {
  if (user.platformAdmin) return true;
  const lista = String(process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(String(user.email || '').toLowerCase());
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService)
    private prisma: PrismaService,
    @Inject(ConfigService)
    private config: ConfigService,
    @Inject('EVENT_BUS')
    private eventBus: EventBus,
  ) {
    this.accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.logger.log('AuthService initialized');
  }


  async register(dto: RegisterDto) {
    this.logger.log(`register - Attempting to register email: ${dto.email}`);
    // 1. Verificar si el usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      this.logger.warn(`register - Email: ${dto.email} is already registered`);
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

    this.logger.log(`register - User: ${user.id} registered successfully. Publishing USER_CREATED event.`);
    // 4. Publicar evento
    await this.eventBus.publish(REDIS_CHANNELS.USER_CREATED, {
      userId: user.id,
      email: user.email,
      clinicId: user.clinicId,
    });

    return user;
  }

  async login(dto: LoginDto) {
    this.logger.log(`login - Attempting login for email: ${dto.email}`);
    // 1. Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true, clinic: { select: { name: true, active: true, entitlements: true } } },
    });

    if (!user || !user.passwordHash) {
      this.logger.warn(`login - User not found or no password hash for email: ${dto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Verificar password
    const passwordValid = await compareBcrypt(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`login - Invalid password for email: ${dto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.comprobarAccesoDeClinica(user);

    // 3. Generar Tokens
    const payload: IJwtPayload = {
      userId: user.id,
      clinicId: user.clinicId,
      role: user.role.name as any,
      email: user.email,
      // Los del rol, recortados a lo que la plataforma le habilita a la clínica.
      permissions: recortarPermisos(user.role.permissions, user.clinic?.entitlements) as any,
      modules: modulosDeClinica(user.clinic?.entitlements),
      platformAdmin: esAdminDePlataforma(user),
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

    this.logger.log(`login - Successful login for user: ${user.id} in clinicId: ${user.clinicId}`);
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 min
      user: {
        id: user.id,
        email: user.email,
        clinic_id: user.clinicId,
        platform_admin: esAdminDePlataforma(user),
        clinic_name: user.clinic?.name ?? null,
        clinic_modules: modulosDeClinica(user.clinic?.entitlements),
        role: {
          id: user.role.id,
          name: user.role.name,
          is_superadmin: user.role.isSuperadmin || false,
          permissions: recortarPermisos(user.role.permissions, user.clinic?.entitlements),
        },
      },
    };
  }

  /**
   * La plataforma puede cortarle la entrada a una clínica entera desde el
   * backoffice (clinics.active = false). El equipo de la plataforma entra igual.
   */
  private comprobarAccesoDeClinica(user: {
    email: string;
    active?: boolean | null;
    platformAdmin?: boolean | null;
    clinic?: { active: boolean | null } | null;
  }) {
    // Una cuenta desactivada no entra, sea de quien sea. Antes el login no lo
    // miraba: desactivar a alguien en "Usuarios" no le impedía iniciar sesión.
    if (user.active === false) {
      this.logger.warn(`Entrada bloqueada: la cuenta ${user.email} está desactivada.`);
      throw new ForbiddenException('Tu cuenta está desactivada. Pide al administrador de tu clínica que la reactive.');
    }
    if (esAdminDePlataforma(user)) return;
    if (user.clinic?.active === false) {
      this.logger.warn(`Entrada bloqueada: la clínica de ${user.email} está suspendida.`);
      throw new ForbiddenException('El acceso de tu clínica a Dentral está suspendido. Escríbenos para reactivarlo.');
    }
  }

  async logout(accessToken: string, refreshToken: string) {
    this.logger.log('logout - Requesting logout');
    // 1. Blacklist Access Token (prefijo blacklist:at:)
    try {
      const decoded = verifyJWT<any>(accessToken, this.accessSecret);
      const ttl = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
      if (ttl > 0) {
        this.logger.log(`logout - Blacklisting access token for ${ttl}s`);
        await this.eventBus.setKey(`blacklist:at:${accessToken}`, 'true', ttl);
      }
    } catch (e) {
      this.logger.warn('logout - Access token validation failed or expired during logout');
    }

    // 2. Revocar Refresh Token en DB
    this.logger.log('logout - Revoking active refresh tokens in database');
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: { not: '' },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async setPassword(dto: any) {
    this.logger.log('setPassword - Setting password via invite token');
    if (dto.password !== dto.password_confirm) {
      this.logger.warn('setPassword - Passwords mismatch');
      throw new BadRequestException('PASSWORDS_DO_NOT_MATCH');
    }

    const user = await this.prisma.user.findFirst({
      where: { inviteToken: dto.token },
    });

    if (!user) {
      this.logger.warn('setPassword - Invite token not found');
      throw new BadRequestException('TOKEN_NOT_FOUND');
    }

    if (user.active === false) {
      this.logger.warn(`setPassword - Invite for deactivated user: ${user.id}`);
      throw new BadRequestException('TOKEN_NOT_FOUND');
    }

    if (user.inviteExpires && user.inviteExpires < new Date()) {
      this.logger.warn(`setPassword - Invite token expired for user: ${user.id}`);
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

    this.logger.log(`setPassword - Password established successfully for user: ${user.id}`);
    return { message: 'Contraseña establecida correctamente' };
  }

  async getMe(userId: string) {
    this.logger.log(`getMe - Fetching user context for userId: ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, clinic: { select: { name: true, active: true, entitlements: true } } },
    });

    if (!user) {
      this.logger.warn(`getMe - User: ${userId} not found`);
      throw new UnauthorizedException();
    }
    this.comprobarAccesoDeClinica(user);

    return {
      id: user.id,
      email: user.email,
      clinic_id: user.clinicId,
      platform_admin: esAdminDePlataforma(user),
      clinic_name: user.clinic?.name ?? null,
      clinic_modules: modulosDeClinica(user.clinic?.entitlements),
      active: user.active,
      role: {
        id: user.role.id,
        name: user.role.name,
        is_superadmin: user.role.isSuperadmin || false,
        permissions: recortarPermisos(user.role.permissions, user.clinic?.entitlements),
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    this.logger.log('refreshTokens - Attempting to refresh tokens');
    // 1. Verificar firma del Refresh Token
    let decoded: { userId: string };
    try {
      decoded = verifyJWT<{ userId: string }>(refreshToken, this.refreshSecret);
    } catch (e) {
      this.logger.warn('refreshTokens - Invalid refresh token signature or expired');
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
      this.logger.warn(`refreshTokens - Token mismatch or expired in database for user: ${decoded.userId}`);
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
      include: { role: true, clinic: { select: { name: true, active: true, entitlements: true } } },
    });

    if (!user) {
      this.logger.warn(`refreshTokens - User ${decoded.userId} not found`);
      throw new UnauthorizedException('Usuario no encontrado');
    }
    // Una clínica bloqueada pierde la sesión en el siguiente refresco (como
    // mucho 15 minutos, lo que dura el token de acceso).
    this.comprobarAccesoDeClinica(user);

    const payload: IJwtPayload = {
      userId: user.id,
      clinicId: user.clinicId,
      role: user.role.name as any,
      email: user.email,
      // Los del rol, recortados a lo que la plataforma le habilita a la clínica.
      permissions: recortarPermisos(user.role.permissions, user.clinic?.entitlements) as any,
      modules: modulosDeClinica(user.clinic?.entitlements),
      platformAdmin: esAdminDePlataforma(user),
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

    this.logger.log(`refreshTokens - Tokens refreshed successfully for user: ${user.id}`);
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
