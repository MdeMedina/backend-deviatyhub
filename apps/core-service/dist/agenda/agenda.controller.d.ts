import { AgendaService } from './agenda.service';
import { CreateAppointmentDto, UpdateStatusDto, RescheduleDto } from './dto/appointment.dto';
export declare class AgendaController {
    private readonly agendaService;
    constructor(agendaService: AgendaService);
    getSlots(clinicId: string, date: string, treatmentId?: string, doctorId?: string): Promise<{
        time: string;
        available: boolean;
    }[]>;
    findAll(clinicId: string, startDate: string, endDate: string, doctorId?: string): Promise<({
        doctor: {
            id: string;
            clinicId: string;
            name: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            title: string;
        } | null;
        treatment: {
            id: string;
            clinicId: string;
            name: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
        } | null;
        contact: {
            id: string;
            clinicId: string;
            name: string | null;
            phone: string | null;
            email: string | null;
            updatedAt: Date | null;
            createdAt: Date | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
        } | null;
    } & {
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        treatmentId: string | null;
        contactId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@prisma/client").$Enums.AppointmentStatus;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    })[]>;
    findOne(clinicId: string, id: string): Promise<{
        doctor: {
            id: string;
            clinicId: string;
            name: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            title: string;
        } | null;
        treatment: {
            id: string;
            clinicId: string;
            name: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
        } | null;
        contact: {
            id: string;
            clinicId: string;
            name: string | null;
            phone: string | null;
            email: string | null;
            updatedAt: Date | null;
            createdAt: Date | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
        } | null;
        history: {
            id: string;
            createdAt: Date | null;
            payload: import("@prisma/client/runtime/library").JsonValue | null;
            appointmentId: string;
            event: string;
        }[];
    } & {
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        treatmentId: string | null;
        contactId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@prisma/client").$Enums.AppointmentStatus;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    create(clinicId: string, dto: CreateAppointmentDto): Promise<{
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        treatmentId: string | null;
        contactId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@prisma/client").$Enums.AppointmentStatus;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    updateStatus(clinicId: string, id: string, dto: UpdateStatusDto): Promise<{
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        treatmentId: string | null;
        contactId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@prisma/client").$Enums.AppointmentStatus;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    reschedule(clinicId: string, id: string, dto: RescheduleDto): Promise<{
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        treatmentId: string | null;
        contactId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@prisma/client").$Enums.AppointmentStatus;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
}
//# sourceMappingURL=agenda.controller.d.ts.map