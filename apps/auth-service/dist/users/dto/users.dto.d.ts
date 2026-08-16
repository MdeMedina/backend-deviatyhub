export declare class InviteUserDto {
    email: string;
    roleId: string;
}
export declare class UpdateUserDto {
    email?: string;
    roleId?: string;
    active?: boolean;
    password?: string;
}
export declare class SetPasswordDto {
    token: string;
    password: string;
    password_confirm: string;
}
//# sourceMappingURL=users.dto.d.ts.map