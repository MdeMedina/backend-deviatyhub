import { Injectable, ConflictException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('RolesService initialized');
  }

  async createRole(clinicId: string, dto: CreateRoleDto, creatorIsSuperadmin: boolean) {
    this.logger.log(`createRole - clinicId: ${clinicId}, roleName: ${dto.name}, creatorIsSuperadmin: ${creatorIsSuperadmin}`);
    // Solo un superadmin puede crear otro rol de superadmin
    if (dto.isSuperadmin && !creatorIsSuperadmin) {
      this.logger.warn(`createRole - Unauthorized creation attempt of Superadmin role by non-superadmin in clinicId: ${clinicId}`);
      throw new ForbiddenException('Solo los superadmin pueden crear roles de superadmin');
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

  async findRolesByClinic(clinicId: string) {
    this.logger.log(`findRolesByClinic - clinicId: ${clinicId}`);
    return this.prisma.role.findMany({
      where: { clinicId },
    });
  }

  async updatePermissions(roleId: string, clinicId: string, dto: UpdatePermissionsDto) {
    this.logger.log(`updatePermissions - roleId: ${roleId}, clinicId: ${clinicId}`);
    // Validar propiedad del rol
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.clinicId !== clinicId) {
      this.logger.warn(`updatePermissions - Role not found or clinic mismatch. roleId: ${roleId}, clinicId: ${clinicId}`);
      throw new ForbiddenException('No tienes permiso para modificar este rol');
    }

    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        permissions: dto.permissions,
      },
    });
  }

  async deleteRole(roleId: string, clinicId: string) {
    this.logger.log(`deleteRole - roleId: ${roleId}, clinicId: ${clinicId}`);
    // 1. Verificar existencia y pertenencia
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });

    if (!role || role.clinicId !== clinicId) {
      this.logger.warn(`deleteRole - Role not found or clinic mismatch. roleId: ${roleId}, clinicId: ${clinicId}`);
      throw new ForbiddenException('No tienes permiso para eliminar este rol');
    }

    // 2. Verificar si tiene usuarios vinculados
    if (role._count.users > 0) {
      this.logger.warn(`deleteRole - Cannot delete role: ${roleId} because it has ${role._count.users} users assigned`);
      throw new ConflictException('No se puede eliminar un rol que tiene usuarios asignados');
    }

    return this.prisma.role.delete({
      where: { id: roleId },
    });
  }
}

