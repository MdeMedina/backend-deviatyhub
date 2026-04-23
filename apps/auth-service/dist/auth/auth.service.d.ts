import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { EventBus } from '@deviaty/shared-events';
export declare class AuthService {
    private prisma;
    private config;
    private eventBus;
    private readonly accessSecret;
    private readonly refreshSecret;
    constructor(prisma: PrismaService, config: ConfigService, eventBus: EventBus);
    register(dto: RegisterDto): Promise<{
        email: string;
        id: string;
        clinicId: string;
        createdAt: Date | null;
    }>;
    login(dto: LoginDto): Promise<{
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
    logout(accessToken: string, refreshToken: string): Promise<void>;
    setPassword(dto: any): Promise<{
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
    refreshTokens(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map