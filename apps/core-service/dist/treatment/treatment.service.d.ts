import { PrismaService } from '@deviaty/shared-prisma';
import { CreateTreatmentDto, UpdateTreatmentDto, CreateOfferDto } from './dto/treatment.dto';
export declare class TreatmentService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(clinicId: string, active?: boolean): Promise<({
        doctors: ({
            doctor: {
                name: string;
                id: string;
                clinicId: string;
                updatedAt: Date | null;
                active: boolean | null;
                createdAt: Date | null;
                title: string;
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
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    })[]>;
    findOne(clinicId: string, id: string): Promise<{
        doctors: ({
            doctor: {
                name: string;
                id: string;
                clinicId: string;
                updatedAt: Date | null;
                active: boolean | null;
                createdAt: Date | null;
                title: string;
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
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    }>;
    create(clinicId: string, dto: CreateTreatmentDto): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    }>;
    update(clinicId: string, id: string, dto: UpdateTreatmentDto): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
    }>;
    remove(clinicId: string, id: string): Promise<{
        name: string;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        active: boolean | null;
        createdAt: Date | null;
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
        name: string;
        id: string;
        updatedAt: Date | null;
        description: string;
        category: string;
        durationAvgMin: number | null;
        procedure: string;
        indications: string[];
        contraindications: string[];
        postCare: string[];
        keywords: string[];
    }[]>;
}
//# sourceMappingURL=treatment.service.d.ts.map