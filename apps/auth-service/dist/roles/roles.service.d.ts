import { PrismaService } from '@deviaty/shared-prisma';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';
export declare class RolesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createRole(clinicId: string, dto: CreateRoleDto, creatorIsSuperadmin: boolean): Promise<{
        id: string;
        createdAt: Date | null;
        clinicId: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }>;
    findRolesByClinic(clinicId: string): Promise<{
        id: string;
        createdAt: Date | null;
        clinicId: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    updatePermissions(roleId: string, clinicId: string, dto: UpdatePermissionsDto): Promise<{
        id: string;
        createdAt: Date | null;
        clinicId: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }>;
    deleteRole(roleId: string, clinicId: string): Promise<{
        id: string;
        createdAt: Date | null;
        clinicId: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }>;
}
//# sourceMappingURL=roles.service.d.ts.map