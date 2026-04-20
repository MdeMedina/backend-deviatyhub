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
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
let PermissionsGuard = class PermissionsGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        // 1. Extraer el permiso requerido del metadata
        const requiredPermission = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        // Si no hay permiso requerido, se permite el acceso (ya pasó por JWT)
        if (!requiredPermission) {
            return true;
        }
        // 2. Extraer el usuario del request (inyectado por JwtAuthGuard)
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            return false; // No debería pasar si JwtAuthGuard está bien configurado
        }
        // 3. Bypass total para Superadmin
        // Nota: Verificamos tanto el flag explícito como si los permisos son nulos (indicando superpoderes)
        if (user.role === 'ADMIN' || user.isSuperadmin) {
            // En este sistema, el ADMIN de la clínica tiene control total sobre su clínica,
            // pero el "Superadmin de Plataforma" se define por permisos o flags adicionales.
            // Por simplicidad en esta fase, el rol ADMIN tiene todos los permisos.
            return true;
        }
        // 4. Validación granular: modulo.accion (ej: "users.view")
        const [module, action] = requiredPermission.split('.');
        const userPermissions = user.permissions;
        if (userPermissions && userPermissions[module] && userPermissions[module][action] === true) {
            return true;
        }
        throw new common_1.ForbiddenException(`No tienes permiso para realizar esta acción (${requiredPermission})`);
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map