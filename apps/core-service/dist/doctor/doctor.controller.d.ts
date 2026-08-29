import { DoctorService } from './doctor.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';
export declare class DoctorController {
    private readonly doctorService;
    private readonly logger;
    constructor(doctorService: DoctorService);
    findAll(clinicId: string, active?: string): Promise<{
        id: any;
        name: any;
        title: any;
        active: any;
        treatments: any;
    }[]>;
    findOne(clinicId: string, id: string): Promise<{
        id: any;
        name: any;
        title: any;
        active: any;
        treatments: any;
    }>;
    create(clinicId: string, dto: CreateDoctorDto): Promise<{
        id: any;
        name: any;
        title: any;
        active: any;
        treatments: any;
    }>;
    update(clinicId: string, id: string, dto: UpdateDoctorDto): Promise<{
        id: any;
        name: any;
        title: any;
        active: any;
        treatments: any;
    }>;
    updatePut(clinicId: string, id: string, dto: UpdateDoctorDto): Promise<{
        id: any;
        name: any;
        title: any;
        active: any;
        treatments: any;
    }>;
    remove(clinicId: string, id: string): Promise<{
        id: string;
        clinicId: string;
        name: string;
        title: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
}
//# sourceMappingURL=doctor.controller.d.ts.map