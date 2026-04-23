import { RolesService } from './roles.service';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
    create(clinicId: string, isSuperadmin: string, createRoleDto: CreateRoleDto): Promise<{
        id: string;
        clinicId: string;
        createdAt: Date | null;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }>;
    findAll(clinicId: string): Promise<{
        id: string;
        clinicId: string;
        createdAt: Date | null;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    update(id: string, clinicId: string, updatePermissionsDto: UpdatePermissionsDto): Promise<{
        id: string;
        clinicId: string;
        createdAt: Date | null;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }>;
    remove(id: string, clinicId: string): Promise<{
        id: string;
        clinicId: string;
        createdAt: Date | null;
        name: string;
        isSuperadmin: boolean | null;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    }>;
}
//# sourceMappingURL=roles.controller.d.ts.map