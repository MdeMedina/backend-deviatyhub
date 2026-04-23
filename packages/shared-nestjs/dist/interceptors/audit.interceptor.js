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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const index_1 = require("../decorators/index");
let AuditInterceptor = class AuditInterceptor {
    reflector;
    prisma;
    sensitiveKeys = [
        'passwordHash',
        'tokenHash',
        'password',
        'refreshToken',
    ];
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async intercept(context, next) {
        const entity = this.reflector.get(index_1.AUDIT_ENTITY_KEY, context.getHandler());
        // Si no tiene el decorador, ignorar
        if (!entity)
            return next.handle();
        const request = context.switchToHttp().getRequest();
        const { method, params, user } = request;
        // Solo auditamos mutaciones (POST, PATCH, PUT, DELETE)
        if (method === 'GET')
            return next.handle();
        const entityId = params.id;
        let beforeData = null;
        // Intentar capturar estado previo para UPDATE/DELETE
        if (entityId &&
            (method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
            try {
                beforeData = await this.prisma[entity].findUnique({
                    where: { id: entityId },
                });
            }
            catch (e) {
                console.warn(`[Audit] No se pudo obtener estado previo para ${entity}:${entityId}`);
            }
        }
        return next.handle().pipe((0, rxjs_1.tap)(async (afterData) => {
            try {
                // Extraer clinicId y userId del request (poblado por JwtAuthGuard en Gateway o Auth)
                // Nota: El Gateway pasa x-clinic-id y x-user-id en los headers
                const clinicId = user?.clinicId || request.headers['x-clinic-id'];
                const userId = user?.userId || request.headers['x-user-id'];
                if (!clinicId || !userId)
                    return;
                // Sanitizar datos
                const sanitizedBefore = this.sanitize(beforeData);
                const sanitizedAfter = this.sanitize(afterData);
                // Crear registro de auditoría
                await this.prisma.auditLog.create({
                    data: {
                        clinicId,
                        userId,
                        entity,
                        entityId: entityId ||
                            afterData?.id ||
                            '00000000-0000-0000-0000-000000000000',
                        action: method,
                        changes: {
                            before: sanitizedBefore || {},
                            after: sanitizedAfter || {},
                        },
                    },
                });
            }
            catch (error) {
                console.error('[Audit] Error persistiendo log de auditoría:', error);
            }
        }));
    }
    sanitize(data) {
        if (!data || typeof data !== 'object')
            return data;
        const sanitized = { ...data };
        for (const key of this.sensitiveKeys) {
            if (key in sanitized) {
                sanitized[key] = '[REDACTED]';
            }
        }
        return sanitized;
    }
};
exports.AuditInterceptor = AuditInterceptor;
exports.AuditInterceptor = AuditInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        shared_prisma_1.PrismaService])
], AuditInterceptor);
//# sourceMappingURL=audit.interceptor.js.map