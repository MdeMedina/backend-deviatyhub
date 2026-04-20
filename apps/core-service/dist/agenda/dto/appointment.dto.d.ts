export declare enum AppointmentStatusDto {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    RESCHEDULED = "RESCHEDULED",
    CANCELLED = "CANCELLED",
    COMPLETED = "COMPLETED"
}
export declare enum AppointmentSourceDto {
    AGENT = "AGENT",
    HUMAN = "HUMAN",
    EXTERNAL = "EXTERNAL"
}
export declare class CreateAppointmentDto {
    contact_id?: string;
    contact_name?: string;
    contact_phone?: string;
    treatment_id: string;
    doctor_id: string;
    scheduled_at: Date;
    source?: AppointmentSourceDto;
    notes?: string;
    conversation_id?: string;
}
export declare class UpdateStatusDto {
    status: AppointmentStatusDto;
    notes?: string;
}
export declare class RescheduleDto {
    scheduled_at: Date;
    notes?: string;
}
//# sourceMappingURL=appointment.dto.d.ts.map