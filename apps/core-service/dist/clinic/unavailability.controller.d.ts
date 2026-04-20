import { ClinicService } from './clinic.service';
import { CreateUnavailabilityDto, UpdateUnavailabilityDto } from './dto/clinic.dto';
export declare class UnavailabilityController {
    private readonly clinicService;
    constructor(clinicService: ClinicService);
    findAll(clinicId: string): Promise<{
        id: string;
        clinicId: string;
        name: string;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }[]>;
    create(clinicId: string, dto: CreateUnavailabilityDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    update(clinicId: string, id: string, dto: UpdateUnavailabilityDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    remove(clinicId: string, id: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=unavailability.controller.d.ts.map