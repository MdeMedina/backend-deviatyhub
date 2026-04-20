import { PrismaService } from '@deviaty/shared-prisma';
import { CreateTreatmentDto, UpdateTreatmentDto, CreateOfferDto } from './dto/treatment.dto';
export declare class TreatmentService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(clinicId: string, active?: boolean): Promise<({
        doctors: ({
            doctor: {
                id: string;
                clinicId: string;
                name: string;
                title: string;
                active: boolean | null;
                createdAt: Date | null;
                updatedAt: Date | null;
            };
        } & {
            id: string;
            clinicId: string;
            doctorId: string;
            treatmentId: string;
        })[];
        offers: {
            id: string;
            clinicId: string;
            active: boolean | null;
            createdAt: Date | null;
            treatmentId: string;
            label: string;
            price: number;
            validUntil: Date | null;
        }[];
    } & {
        id: string;
        clinicId: string;
        name: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    })[]>;
    findOne(clinicId: string, id: string): Promise<{
        doctors: ({
            doctor: {
                id: string;
                clinicId: string;
                name: string;
                title: string;
                active: boolean | null;
                createdAt: Date | null;
                updatedAt: Date | null;
            };
        } & {
            id: string;
            clinicId: string;
            doctorId: string;
            treatmentId: string;
        })[];
        offers: {
            id: string;
            clinicId: string;
            active: boolean | null;
            createdAt: Date | null;
            treatmentId: string;
            label: string;
            price: number;
            validUntil: Date | null;
        }[];
    } & {
        id: string;
        clinicId: string;
        name: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    }>;
    create(clinicId: string, dto: CreateTreatmentDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    }>;
    update(clinicId: string, id: string, dto: UpdateTreatmentDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    }>;
    remove(clinicId: string, id: string): Promise<{
        id: string;
        clinicId: string;
        name: string;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    }>;
    createOffer(clinicId: string, treatmentId: string, dto: CreateOfferDto): Promise<{
        id: string;
        clinicId: string;
        active: boolean | null;
        createdAt: Date | null;
        treatmentId: string;
        label: string;
        price: number;
        validUntil: Date | null;
    }>;
    deleteOffer(clinicId: string, treatmentId: string, offerId: string): Promise<{
        id: string;
        clinicId: string;
        active: boolean | null;
        createdAt: Date | null;
        treatmentId: string;
        label: string;
        price: number;
        validUntil: Date | null;
    }>;
    getEncyclopedia(category?: string, search?: string): Promise<{
        id: string;
        name: string;
        updatedAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        description: string;
        procedure: string;
        indications: string[];
        contraindications: string[];
        postCare: string[];
        keywords: string[];
    }[]>;
}
//# sourceMappingURL=treatment.service.d.ts.map