export declare class UpdateClinicConfigDto {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    timezone?: string;
    language?: string;
}
export declare class ClinicScheduleDto {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_open?: boolean;
}
export declare class UpdateSchedulesDto {
    schedules: ClinicScheduleDto[];
}
export declare class CreateUnavailabilityDto {
    name: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
}
export declare class UpdateUnavailabilityDto {
    name?: string;
    days_of_week?: number[];
    start_time?: string;
    end_time?: string;
    active?: boolean;
}
export declare class CreatePolicyDto {
    title: string;
    description: string;
}
export declare class UpdatePolicyDto {
    title?: string;
    description?: string;
    active?: boolean;
}
//# sourceMappingURL=clinic.dto.d.ts.map