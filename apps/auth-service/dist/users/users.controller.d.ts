import { UsersService } from './users.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    invite(clinicId: string, inviteUserDto: InviteUserDto): Promise<{
        role: {
            id: string;
            createdAt: Date | null;
            clinicId: string;
            name: string;
            isSuperadmin: boolean | null;
            permissions: import("@prisma/client/runtime/library").JsonValue;
        };
    } & {
        id: string;
        email: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        clinicId: string;
        roleId: string;
    }>;
    findAll(clinicId: string, page?: number, limit?: number): Promise<{
        data: ({
            role: {
                id: string;
                createdAt: Date | null;
                clinicId: string;
                name: string;
                isSuperadmin: boolean | null;
                permissions: import("@prisma/client/runtime/library").JsonValue;
            };
        } & {
            id: string;
            email: string;
            passwordHash: string | null;
            inviteToken: string | null;
            inviteExpires: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            updatedAt: Date | null;
            clinicId: string;
            roleId: string;
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
            createdAt: Date | null;
            clinicId: string;
            name: string;
            isSuperadmin: boolean | null;
            permissions: import("@prisma/client/runtime/library").JsonValue;
        };
    } & {
        id: string;
        email: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        clinicId: string;
        roleId: string;
    }>;
    update(id: string, clinicId: string, updateUserDto: UpdateUserDto): Promise<{
        role: {
            id: string;
            createdAt: Date | null;
            clinicId: string;
            name: string;
            isSuperadmin: boolean | null;
            permissions: import("@prisma/client/runtime/library").JsonValue;
        };
    } & {
        id: string;
        email: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        clinicId: string;
        roleId: string;
    }>;
    remove(id: string, clinicId: string): Promise<{
        id: string;
        email: string;
        passwordHash: string | null;
        inviteToken: string | null;
        inviteExpires: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        clinicId: string;
        roleId: string;
    }>;
}
//# sourceMappingURL=users.controller.d.ts.map