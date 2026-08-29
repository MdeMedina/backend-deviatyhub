import { RolesService } from './roles.service';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';
export declare class RolesController {
    private readonly rolesService;
    private readonly logger;
    constructor(rolesService: RolesService);
    create(clinicId: string, isSuperadmin: string, createRoleDto: CreateRoleDto): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }>;
    findAll(clinicId: string): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }[]>;
    update(id: string, clinicId: string, updatePermissionsDto: UpdatePermissionsDto): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }>;
    remove(id: string, clinicId: string): Promise<{
        id: string;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date | null;
        clinicId: string;
    }>;
}
//# sourceMappingURL=roles.controller.d.ts.map