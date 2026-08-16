import { PrismaService, Prisma } from "@deviaty/shared-prisma";
import { UpdateClinicConfigDto, UpdateSchedulesDto, CreateUnavailabilityDto, UpdateUnavailabilityDto, CreatePolicyDto, UpdatePolicyDto } from './dto/clinic.dto';
export declare class ClinicService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getConfig(clinicId: string): Promise<{
        id: string;
        clinicId: string;
        name: string;
        address: string;
        phone: string;
        email: string;
        timezone: string;
        language: string;
        updatedAt: Date | null;
    }>;
    updateConfig(clinicId: string, dto: UpdateClinicConfigDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        address: string;
        phone: string;
        email: string;
        timezone: string;
        language: string;
        updatedAt: Date | null;
    }>;
    getSchedules(clinicId: string): Promise<{
        day_of_week: number;
        open_time: string;
        close_time: string;
        is_open: boolean;
    }[]>;
    updateSchedules(clinicId: string, dto: UpdateSchedulesDto): Promise<{
        message: string;
    }>;
    private mapUnavailabilityToFrontend;
    getUnavailability(clinicId: string): Promise<{
        id: any;
        name: any;
        days_of_week: any;
        start_time: any;
        end_time: any;
        active: any;
    }[]>;
    createUnavailability(clinicId: string, dto: CreateUnavailabilityDto): Promise<{
        id: any;
        name: any;
        days_of_week: any;
        start_time: any;
        end_time: any;
        active: any;
    }>;
    updateUnavailability(clinicId: string, id: string, dto: UpdateUnavailabilityDto): Promise<{
        id: any;
        name: any;
        days_of_week: any;
        start_time: any;
        end_time: any;
        active: any;
    }>;
    deleteUnavailability(clinicId: string, id: string): Promise<{
        message: string;
    }>;
    getPolicies(clinicId: string): Promise<{
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
        description: string;
    }[]>;
    createPolicy(clinicId: string, dto: CreatePolicyDto): Promise<{
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
        description: string;
    }>;
    updatePolicy(clinicId: string, id: string, dto: UpdatePolicyDto): Promise<{
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
        description: string;
    }>;
    deletePolicy(clinicId: string, id: string): Promise<{
        message: string;
    }>;
    getAgentConfig(clinicId: string): Promise<{
        id: string;
        clinic_id: string;
        actions: Prisma.JsonValue;
        updated_at: Date | null;
    }>;
    updateAgentConfig(clinicId: string, dto: {
        actions: any;
    }): Promise<{
        id: string;
        clinic_id: string;
        actions: Prisma.JsonValue;
        updated_at: Date | null;
    }>;
    getIntegrations(clinicId: string): Promise<{
        type: string;
        connected: boolean;
        last_tested_at: string;
        last_test_ok: boolean;
        latency_ms: any;
    }[]>;
    testConnection(clinicId: string, typeStr: string): Promise<{
        ok: boolean;
        tested_at: string;
        latency_ms: number;
        error: string | undefined;
    }>;
    saveCredentials(clinicId: string, typeStr: string, credentials: Record<string, string>): Promise<{
        success: boolean;
        message: string;
    }>;
    getIntegrationDetails(clinicId: string, typeStr: string): Promise<{
        type: string;
        connected: boolean;
        last_tested_at: string | null;
        last_test_ok: boolean | null;
        fields: {
            key: any;
            label: any;
            type: any;
            required: any;
            configured: boolean;
            value: string;
        }[];
    }>;
}
//# sourceMappingURL=clinic.service.d.ts.map