import { Injectable, ConflictException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';

@Injectable()
export class RolesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createRole(clinicId: string, dto: CreateRoleDto, creatorIsSuperadmin: boolean) {
    // Solo un superadmin puede crear otro rol de superadmin
    if (dto.isSuperadmin && !creatorIsSuperadmin) {
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
    return this.prisma.role.findMany({
      where: { clinicId },
    });
  }

  async updatePermissions(roleId: string, clinicId: string, dto: UpdatePermissionsDto) {
    // Validar propiedad del rol
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.clinicId !== clinicId) {
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
    // 1. Verificar existencia y pertenencia
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });

    if (!role || role.clinicId !== clinicId) {
      throw new ForbiddenException('No tienes permiso para eliminar este rol');
    }

    // 2. Verificar si tiene usuarios vinculados
    if (role._count.users > 0) {
      throw new ConflictException('No se puede eliminar un rol que tiene usuarios asignados');
    }

    return this.prisma.role.delete({
      where: { id: roleId },
    });
  }
}
