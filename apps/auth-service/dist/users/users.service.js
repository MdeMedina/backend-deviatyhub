"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const shared_events_1 = require("@deviaty/shared-events");
const crypto = __importStar(require("crypto"));
let UsersService = class UsersService {
    prisma;
    eventBus;
    constructor(prisma, eventBus) {
        this.prisma = prisma;
        this.eventBus = eventBus;
    }
    async invite(clinicId, dto) {
        // 1. Verificar si ya existe
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw new common_1.ConflictException('El correo ya está registrado');
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
        await this.eventBus.publish(shared_events_1.REDIS_CHANNELS.USER_INVITED, {
            userId: user.id,
            email: user.email,
            inviteToken: user.inviteToken,
            clinicId: user.clinicId,
        });
        return user;
    }
    async findAll(clinicId, page = 1, limit = 20) {
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
    async findOne(id, clinicId) {
        const user = await this.prisma.user.findFirst({
            where: { id, clinicId },
            include: { role: true },
        });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        return user;
    }
    async update(id, clinicId, dto) {
        return this.prisma.user.update({
            where: { id, clinicId },
            data: dto,
            include: { role: true },
        });
    }
    async remove(id, clinicId) {
        return this.prisma.user.update({
            where: { id, clinicId },
            data: { active: false },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __param(1, (0, common_1.Inject)('EVENT_BUS')),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService,
        shared_events_1.EventBus])
], UsersService);
//# sourceMappingURL=users.service.js.map