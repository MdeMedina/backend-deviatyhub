import { ClinicService } from './clinic.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/clinic.dto';
export declare class PoliciesController {
    private readonly clinicService;
    constructor(clinicService: ClinicService);
    findAll(clinicId: string): Promise<{
        id: string;
        clinicId: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        title: string;
        description: string;
    }[]>;
    create(clinicId: string, dto: CreatePolicyDto): Promise<{
        id: string;
        clinicId: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        title: string;
        description: string;
    }>;
    update(clinicId: string, id: string, dto: UpdatePolicyDto): Promise<{
        id: string;
        clinicId: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        title: string;
        description: string;
    }>;
    remove(clinicId: string, id: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=policies.controller.d.ts.map