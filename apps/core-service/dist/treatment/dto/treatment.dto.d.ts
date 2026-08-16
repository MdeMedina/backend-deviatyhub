export declare class CreateTreatmentDto {
    name: string;
    category?: string;
    duration_avg_min?: number;
    encyclopedia_ref?: string;
    doctor_ids?: string[];
    description?: string;
    price?: number;
    duration_min?: number;
    price_isapre?: number;
    price_fonasa?: number;
    accepts_isapre?: boolean;
    accepts_fonasa?: boolean;
    active?: boolean;
    doctors?: any[];
    offers?: any[];
}
export declare class UpdateTreatmentDto {
    name?: string;
    category?: string;
    duration_avg_min?: number;
    encyclopedia_ref?: string;
    doctor_ids?: string[];
    active?: boolean;
    description?: string;
    price?: number;
    duration_min?: number;
    price_isapre?: number;
    price_fonasa?: number;
    accepts_isapre?: boolean;
    accepts_fonasa?: boolean;
    doctors?: any[];
    offers?: any[];
}
export declare class CreateOfferDto {
    label: string;
    price?: number;
    discount_pct?: number;
    fixed_price?: number;
    valid_from?: string;
    valid_until?: string;
    active?: boolean;
}
//# sourceMappingURL=treatment.dto.d.ts.map