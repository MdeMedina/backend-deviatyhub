"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const shared_utils_1 = require("@deviaty/shared-utils");
const shared_events_1 = require("@deviaty/shared-events");
let AuthService = class AuthService {
    prisma;
    config;
    eventBus;
    accessSecret;
    refreshSecret;
    constructor(prisma, config, eventBus) {
        this.prisma = prisma;
        this.config = config;
        this.eventBus = eventBus;
        this.accessSecret = this.config.get('JWT_ACCESS_SECRET', 'dev-access-secret');
        this.refreshSecret = this.config.get('JWT_REFRESH_SECRET', 'dev-refresh-secret');
    }
    async register(dto) {
        // 1. Verificar si el usuario ya existe
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('El correo ya está registrado');
        }
        // 2. Hashear password
        const passwordHash = await (0, shared_utils_1.hashBcrypt)(dto.password);
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
        await this.eventBus.publish(shared_events_1.REDIS_CHANNELS.USER_CREATED, {
            userId: user.id,
            email: user.email,
            clinicId: user.clinicId,
        });
        return user;
    }
    async login(dto) {
        // 1. Buscar usuario
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { role: true },
        });
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        // 2. Verificar password
        const passwordValid = await (0, shared_utils_1.compareBcrypt)(dto.password, user.passwordHash);
        if (!passwordValid) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        // 3. Generar Tokens
        const payload = {
            userId: user.id,
            clinicId: user.clinicId,
            role: user.role.name,
            email: user.email,
            permissions: user.role.permissions,
        };
        const accessToken = (0, shared_utils_1.signJWT)(payload, this.accessSecret, '15m');
        const refreshToken = (0, shared_utils_1.signJWT)({ userId: user.id }, this.refreshSecret, '7d');
        // 4. Guardar Refresh Token (Hash para seguridad)
        const refreshTokenHash = await (0, shared_utils_1.hashBcrypt)(refreshToken);
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
    async logout(accessToken, refreshToken) {
        // 1. Blacklist Access Token (prefijo blacklist:at:)
        // Decodificar para obtener el JTI (o usar el token completo como key)
        try {
            const decoded = (0, shared_utils_1.verifyJWT)(accessToken, this.accessSecret);
            const ttl = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
            if (ttl > 0) {
                await this.eventBus.setKey(`blacklist:at:${accessToken}`, 'true', ttl);
            }
        }
        catch (e) {
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
    async setPassword(dto) {
        if (dto.password !== dto.password_confirm) {
            throw new common_1.BadRequestException('PASSWORDS_DO_NOT_MATCH');
        }
        const user = await this.prisma.user.findFirst({
            where: { inviteToken: dto.token },
        });
        if (!user) {
            throw new common_1.BadRequestException('TOKEN_NOT_FOUND');
        }
        if (user.inviteExpires && user.inviteExpires < new Date()) {
            throw new common_1.BadRequestException('TOKEN_EXPIRED');
        }
        const passwordHash = await (0, shared_utils_1.hashBcrypt)(dto.password);
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
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { role: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException();
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
    async refreshTokens(refreshToken) {
        // 1. Verificar firma del Refresh Token
        let decoded;
        try {
            decoded = (0, shared_utils_1.verifyJWT)(refreshToken, this.refreshSecret);
        }
        catch (e) {
            throw new common_1.UnauthorizedException('Refresh Token inválido o expirado');
        }
        // 2. Buscar el token en DB (hash)
        const tokens = await this.prisma.refreshToken.findMany({
            where: { userId: decoded.userId, revokedAt: null },
        });
        // Validar contra el hash de cada token activo
        let dbToken = null;
        for (const t of tokens) {
            if (await (0, shared_utils_1.compareBcrypt)(refreshToken, t.tokenHash)) {
                dbToken = t;
                break;
            }
        }
        if (!dbToken || dbToken.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Refresh Token no encontrado o expirado');
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
        if (!user)
            throw new common_1.UnauthorizedException('Usuario no encontrado');
        const payload = {
            userId: user.id,
            clinicId: user.clinicId,
            role: user.role.name,
            email: user.email,
            permissions: user.role.permissions,
        };
        const newAccessToken = (0, shared_utils_1.signJWT)(payload, this.accessSecret, '15m');
        const newRefreshToken = (0, shared_utils_1.signJWT)({ userId: user.id }, this.refreshSecret, '7d');
        // 5. Guardar el nuevo hash
        const newRefreshTokenHash = await (0, shared_utils_1.hashBcrypt)(newRefreshToken);
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __param(1, (0, common_1.Inject)(config_1.ConfigService)),
    __param(2, (0, common_1.Inject)('EVENT_BUS')),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService,
        config_1.ConfigService,
        shared_events_1.EventBus])
], AuthService);
//# sourceMappingURL=auth.service.js.map