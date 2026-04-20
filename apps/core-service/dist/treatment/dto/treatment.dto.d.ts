export declare class CreateTreatmentDto {
    name: string;
    category: string;
    duration_avg_min?: number;
    encyclopedia_ref?: string;
    doctor_ids?: string[];
}
export declare class UpdateTreatmentDto {
    name?: string;
    category?: string;
    duration_avg_min?: number;
    encyclopedia_ref?: string;
    doctor_ids?: string[];
    active?: boolean;
}
export declare class CreateOfferDto {
    label: string;
    price: number;
    valid_until?: Date;
}
//# sourceMappingURL=treatment.dto.d.ts.map