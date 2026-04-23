import { UsersService } from './users.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    invite(clinicId: string, inviteUserDto: InviteUserDto): Promise<{
        role: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            name: string;
            isSuperadmin: boolean | null;
            permissions: import("@prisma/client/runtime/library").JsonValue;
        };
    } & {
        email: string;
        id: string;
        clinicId: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        roleId: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    findAll(clinicId: string, page?: number, limit?: number): Promise<{
        data: ({
            role: {
                id: string;
                clinicId: string;
                createdAt: Date | null;
                name: string;
                isSuperadmin: boolean | null;
                permissions: import("@prisma/client/runtime/library").JsonValue;
            };
        } & {
            email: string;
            id: string;
            clinicId: string;
            passwordHash: string | null;
            inviteToken: string | null;
            inviteExpires: Date | null;
            roleId: string;
            active: boolean | null;
            createdAt: Date | null;
            updatedAt: Date | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            total_pages: number;
        };
    }>;
    findOne(id: string, clinicId: string): Promise<{
        role: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            name: string;
            isSuperadmin: boolean | null;
            permissions: import("@prisma/client/runtime/library").JsonValue;
        };
    } & {
        email: string;
        id: string;
        clinicId: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        roleId: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    update(id: string, clinicId: string, updateUserDto: UpdateUserDto): Promise<{
        role: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            name: string;
            isSuperadmin: boolean | null;
            permissions: import("@prisma/client/runtime/library").JsonValue;
        };
    } & {
        email: string;
        id: string;
        clinicId: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        roleId: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    remove(id: string, clinicId: string): Promise<{
        email: string;
        id: string;
        clinicId: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        roleId: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
}
//# sourceMappingURL=users.controller.d.ts.map