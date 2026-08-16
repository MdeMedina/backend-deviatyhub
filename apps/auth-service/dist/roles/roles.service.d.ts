import { PrismaService } from '@deviaty/shared-prisma';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';
export declare class RolesService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    createRole(clinicId: string, dto: CreateRoleDto, creatorIsSuperadmin: boolean): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }>;
    findRolesByClinic(clinicId: string): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }[]>;
    updatePermissions(roleId: string, clinicId: string, dto: UpdatePermissionsDto): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }>;
    deleteRole(roleId: string, clinicId: string): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }>;
}
//# sourceMappingURL=roles.service.d.ts.map