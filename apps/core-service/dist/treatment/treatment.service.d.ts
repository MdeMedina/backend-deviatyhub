import { PrismaService } from "@deviaty/shared-prisma";
import { CreateTreatmentDto, UpdateTreatmentDto, CreateOfferDto } from './dto/treatment.dto';
export declare class TreatmentService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    findAll(clinicId: string, active?: boolean): Promise<any[]>;
    findOne(clinicId: string, id: string): Promise<any>;
    create(clinicId: string, dto: CreateTreatmentDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    update(clinicId: string, id: string, dto: UpdateTreatmentDto): Promise<{
        id: string;
        clinicId: string;
        name: string;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    remove(clinicId: string, id: string): Promise<{
        id: string;
        clinicId: string;
        name: string;
        category: string;
        durationAvgMin: number | null;
        encyclopediaRef: string | null;
        active: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    private mapOfferToFrontend;
    private mapTreatmentToFrontend;
    createOffer(clinicId: string, treatmentId: string, dto: CreateOfferDto): Promise<{
        id: any;
        label: any;
        discount_pct: number;
        fixed_price: any;
        valid_from: any;
        valid_until: any;
        active: any;
        price: any;
    }>;
    deleteOffer(clinicId: string, treatmentId: string, offerId: string): Promise<{
        id: any;
        label: any;
        discount_pct: number;
        fixed_price: any;
        valid_from: any;
        valid_until: any;
        active: any;
        price: any;
    }>;
    getEncyclopedia(category?: string, search?: string): Promise<{
        id: string;
        name: string;
        category: string;
        durationAvgMin: number | null;
        updatedAt: Date | null;
        description: string;
        procedure: string;
        indications: string[];
        contraindications: string[];
        postCare: string[];
        keywords: string[];
    }[]>;
}
//# sourceMappingURL=treatment.service.d.ts.map