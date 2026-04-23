import { TreatmentService } from './treatment.service';
import { CreateTreatmentDto, UpdateTreatmentDto, CreateOfferDto } from './dto/treatment.dto';
export declare class TreatmentController {
    private readonly treatmentService;
    constructor(treatmentService: TreatmentService);
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
    findAll(clinicId: string, active?: string): Promise<({
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
    createOffer(clinicId: string, id: string, dto: CreateOfferDto): Promise<{
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
}
//# sourceMappingURL=treatment.controller.d.ts.map