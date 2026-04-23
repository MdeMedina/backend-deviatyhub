import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { SetPasswordDto } from '../users/dto/users.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        email: string;
        id: string;
        clinicId: string;
        createdAt: Date | null;
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
        user: {
            id: string;
            email: string;
            clinic_id: string;
            role: {
                id: string;
                name: string;
                is_superadmin: boolean;
                permissions: import("@prisma/client/runtime/library").JsonValue;
            };
        };
    }>;
    refresh(refreshTokenDto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(auth: string, dto: RefreshTokenDto): Promise<{
        message: string;
    }>;
    setPassword(setPasswordDto: SetPasswordDto): Promise<{
        message: string;
    }>;
    getMe(userId: string): Promise<{
        id: string;
        email: string;
        clinic_id: string;
        active: boolean | null;
        role: {
            id: string;
            name: string;
            is_superadmin: boolean;
            permissions: import("@prisma/client/runtime/library").JsonValue;
        };
    }>;
}
//# sourceMappingURL=auth.controller.d.ts.map