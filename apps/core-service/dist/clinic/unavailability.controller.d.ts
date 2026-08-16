import { ClinicService } from './clinic.service';
import { CreateUnavailabilityDto, UpdateUnavailabilityDto } from './dto/clinic.dto';
export declare class UnavailabilityController {
    private readonly clinicService;
    constructor(clinicService: ClinicService);
    findAll(clinicId: string): Promise<{
        id: any;
        name: any;
        days_of_week: any;
        start_time: any;
        end_time: any;
        active: any;
    }[]>;
    create(clinicId: string, dto: CreateUnavailabilityDto): Promise<{
        id: any;
        name: any;
        days_of_week: any;
        start_time: any;
        end_time: any;
        active: any;
    }>;
    update(clinicId: string, id: string, dto: UpdateUnavailabilityDto): Promise<{
        id: any;
        name: any;
        days_of_week: any;
        start_time: any;
        end_time: any;
        active: any;
    }>;
    remove(clinicId: string, id: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=unavailability.controller.d.ts.map