import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { recortarPermisos } from '@deviaty/shared-utils';
import { esAdminDePlataforma } from '../auth/auth.service';

/**
 * Quien hace la petición, leído de la base y no del token: si le cambian el
 * rol o le quitan permisos, se nota en la siguiente petición y no a los 15
 * minutos. El gateway pone x-user-id y x-clinic-id (la clínica en la que
 * trabaja, que para el equipo de la plataforma es la que eligió).
 */
export interface Actor {
  id: string;
  roleId: string;
  /** Equipo de la plataforma: dentro de una clínica tiene lo del dueño. */
  plataforma: boolean;
  /** Administrador de la clínica (rol con isSuperadmin) o de la plataforma. */
  admin: boolean;
  permisos: Record<string, any>;
}

export async function cargarActor(
  prisma: PrismaService,
  userId: string | undefined,
  clinicId: string | undefined,
): Promise<Actor> {
  if (!userId || !clinicId) throw new UnauthorizedException('Sesión requerida');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, clinic: { select: { entitlements: true } } },
  });
  if (!user || user.active === false) throw new UnauthorizedException('Sesión requerida');

  const plataforma = esAdminDePlataforma(user);
  // Fuera de la plataforma, solo se trabaja en la clínica propia.
  if (!plataforma && user.clinicId !== clinicId) {
    throw new ForbiddenException('No perteneces a esta clínica');
  }

  return {
    id: user.id,
    roleId: user.roleId,
    plataforma,
    admin: plataforma || user.role?.isSuperadmin === true,
    permisos: recortarPermisos(user.role?.permissions, user.clinic?.entitlements),
  };
}

/** Permiso 'modulo.accion' del rol. El administrador lo tiene todo. */
export function puede(actor: Actor, permiso: string): boolean {
  if (actor.admin) return true;
  const [modulo, accion] = permiso.split('.');
  return actor.permisos?.[modulo]?.[accion] === true;
}

/** Corta con 403 si no tiene ninguno de los permisos. */
export function exigir(actor: Actor, ...permisos: string[]): void {
  if (!permisos.some((p) => puede(actor, p))) {
    throw new ForbiddenException('No tienes permiso para realizar esta acción');
  }
}
