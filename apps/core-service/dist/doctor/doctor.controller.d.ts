import { DoctorService } from './doctor.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';
export declare class DoctorController {
    private readonly doctorService;
    constructor(doctorService: DoctorService);
    findAll(clinicId: string, active?: string): Promise<({
        treatments: ({
            treatment: {
                name: string;
                id: string;
                clinicId: string;
                updatedAt: Date | null;
                active: boolean | null;
                createdAt: Date | null;
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
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
    })[]>;
    findOne(clinicId: string, id: string): Promise<{
        treatments: ({
            treatment: {
                name: string;
                id: string;
                clinicId: string;
                updatedAt: Date | null;
                active: boolean | null;
                createdAt: Date | null;
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
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
    }>;
    create(clinicId: string, dto: CreateDoctorDto): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
    }>;
    update(clinicId: string, id: string, dto: UpdateDoctorDto): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
    }>;
    remove(clinicId: string, id: string): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        title: string;
    }>;
}
//# sourceMappingURL=doctor.controller.d.ts.map