import { DoctorService } from './doctor.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';
export declare class DoctorController {
    private readonly doctorService;
    constructor(doctorService: DoctorService);
    findAll(clinicId: string, active?: string): Promise<({
        treatments: ({
            treatment: {
                id: string;
                clinicId: string;
                name: string;
                active: boolean | null;
                createdAt: Date | null;
                updatedAt: Date | null;
                category: string;
                durationAvgMin: number | null;
                encyclopediaRef: string | null;
            };
        } & {
            id: string;
            clinicId: string;
            doctorId: string;
            treatmentId: string;
        })[];
    } & {
        id: string;
        clinicId: string;
        name: string;
        title: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    })[]>;
    findOne(clinicId: string, id: string): Promise<{
        treatments: ({
            treatment: {
                id: string;
                clinicId: string;
                name: string;
                active: boolean | null;
                createdAt: Date | null;
                updatedAt: Date | null;
                category: string;
                durationAvgMin: number | null;
                encyclopediaRef: string | null;
            };
        } & {
            id: string;
            clinicId: string;
            doctorId: string;
            treatmentId: string;
        })[];
    } & {
        id: string;
        clinicId: string;
        name: string;
        title: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    create(clinicId: string, dto: CreateDoctorDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        title: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    update(clinicId: string, id: string, dto: UpdateDoctorDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        title: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
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