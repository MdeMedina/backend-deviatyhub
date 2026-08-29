import { PrismaService } from "@deviaty/shared-prisma";
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';
export declare class DoctorService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    private mapDoctorToFrontend;
    findAll(clinicId: string, active?: boolean): Promise<{
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
//# sourceMappingURL=doctor.service.d.ts.map