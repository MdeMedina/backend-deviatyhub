import { ClinicService } from './clinic.service';
import { UpdateClinicConfigDto, UpdateSchedulesDto } from './dto/clinic.dto';
export declare class ClinicController {
    private readonly clinicService;
    constructor(clinicService: ClinicService);
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
}
//# sourceMappingURL=clinic.controller.d.ts.map