import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Solo el equipo de la plataforma. El gateway ya corta /api/core/platform a
 * quien no lo es; esto es la segunda llave por si algún día se llega a core por
 * otro camino. La cabecera es de fiar porque la escribe siempre el gateway (la
 * que mande el cliente se sobrescribe) y core no está publicado en internet.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.headers['x-platform-admin'] === 'true') return true;
    throw new ForbiddenException('Solo para el equipo de la plataforma');
  }
}
