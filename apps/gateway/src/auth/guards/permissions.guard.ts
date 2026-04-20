import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IJwtPayload } from '@deviaty/shared-types';
import { PERMISSION_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): Promise<boolean> | boolean {
    // 1. Extraer el permiso requerido del metadata
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay permiso requerido, se permite el acceso (ya pasó por JWT)
    if (!requiredPermission) {
      return true;
    }

    // 2. Extraer el usuario del request (inyectado por JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user as IJwtPayload;

    if (!user) {
      return false; // No debería pasar si JwtAuthGuard está bien configurado
    }

    // 3. Bypass total para Superadmin
    // Nota: Verificamos tanto el flag explícito como si los permisos son nulos (indicando superpoderes)
    if (user.role === 'ADMIN' || (user as any).isSuperadmin) {
      // En este sistema, el ADMIN de la clínica tiene control total sobre su clínica,
      // pero el "Superadmin de Plataforma" se define por permisos o flags adicionales.
      // Por simplicidad en esta fase, el rol ADMIN tiene todos los permisos.
      return true;
    }

    // 4. Validación granular: modulo.accion (ej: "users.view")
    const [module, action] = requiredPermission.split('.');
    
    const userPermissions = user.permissions as any;
    
    if (userPermissions && userPermissions[module] && userPermissions[module][action] === true) {
      return true;
    }

    throw new ForbiddenException(`No tienes permiso para realizar esta acción (${requiredPermission})`);
  }
}
