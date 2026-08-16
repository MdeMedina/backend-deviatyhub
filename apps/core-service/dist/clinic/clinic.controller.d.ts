import { ClinicService } from './clinic.service';
import { UpdateClinicConfigDto, UpdateSchedulesDto } from './dto/clinic.dto';
export declare class ClinicController {
    private readonly clinicService;
    constructor(clinicService: ClinicService);
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
}
//# sourceMappingURL=clinic.controller.d.ts.map