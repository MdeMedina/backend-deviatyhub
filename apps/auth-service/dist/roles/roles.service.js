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
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
let RolesService = class RolesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createRole(clinicId, dto, creatorIsSuperadmin) {
        // Solo un superadmin puede crear otro rol de superadmin
        if (dto.isSuperadmin && !creatorIsSuperadmin) {
            throw new common_1.ForbiddenException('Solo los superadmin pueden crear roles de superadmin');
        }
        return this.prisma.role.create({
            data: {
                name: dto.name,
                clinicId,
                isSuperadmin: dto.isSuperadmin || false,
                permissions: dto.permissions,
            },
        });
    }
    async findRolesByClinic(clinicId) {
        return this.prisma.role.findMany({
            where: { clinicId },
        });
    }
    async updatePermissions(roleId, clinicId, dto) {
        // Validar propiedad del rol
        const role = await this.prisma.role.findUnique({
            where: { id: roleId },
        });
        if (!role || role.clinicId !== clinicId) {
            throw new common_1.ForbiddenException('No tienes permiso para modificar este rol');
        }
        return this.prisma.role.update({
            where: { id: roleId },
            data: {
                permissions: dto.permissions,
            },
        });
    }
    async deleteRole(roleId, clinicId) {
        // 1. Verificar existencia y pertenencia
        const role = await this.prisma.role.findUnique({
            where: { id: roleId },
            include: { _count: { select: { users: true } } },
        });
        if (!role || role.clinicId !== clinicId) {
            throw new common_1.ForbiddenException('No tienes permiso para eliminar este rol');
        }
        // 2. Verificar si tiene usuarios vinculados
        if (role._count.users > 0) {
            throw new common_1.ConflictException('No se puede eliminar un rol que tiene usuarios asignados');
        }
        return this.prisma.role.delete({
            where: { id: roleId },
        });
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], RolesService);
//# sourceMappingURL=roles.service.js.map