import { PrismaService } from '@deviaty/shared-prisma';
import { UpdateClinicConfigDto, UpdateSchedulesDto, CreateUnavailabilityDto, UpdateUnavailabilityDto, CreatePolicyDto, UpdatePolicyDto } from './dto/clinic.dto';
export declare class ClinicService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getConfig(clinicId: string): Promise<{
        name: string;
        id: string;
        clinicId: string;
        address: string;
        phone: string;
        email: string;
        timezone: string;
        language: string;
        updatedAt: Date | null;
    }>;
    updateConfig(clinicId: string, dto: UpdateClinicConfigDto): Promise<{
        name: string;
        id: string;
        clinicId: string;
        address: string;
        phone: string;
        email: string;
        timezone: string;
        language: string;
        updatedAt: Date | null;
    }>;
    getSchedules(clinicId: string): Promise<{
        id: string;
        clinicId: string;
        dayOfWeek: number;
        openTime: string;
        closeTime: string;
        isOpen: boolean | null;
    }[]>;
    updateSchedules(clinicId: string, dto: UpdateSchedulesDto): Promise<{
        message: string;
    }>;
    getUnavailability(clinicId: string): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        active: boolean | null;
        createdAt: Date | null;
    }[]>;
    createUnavailability(clinicId: string, dto: CreateUnavailabilityDto): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        active: boolean | null;
        createdAt: Date | null;
    }>;
    updateUnavailability(clinicId: string, id: string, dto: UpdateUnavailabilityDto): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        active: boolean | null;
        createdAt: Date | null;
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
}
//# sourceMappingURL=clinic.service.d.ts.map