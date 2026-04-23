import { AgendaService } from './agenda.service';
import { CreateAppointmentDto, UpdateStatusDto, RescheduleDto } from './dto/appointment.dto';
export declare class AgendaController {
    private readonly agendaService;
    constructor(agendaService: AgendaService);
    getSlots(clinicId: string, date: string, treatmentId?: string, doctorId?: string): Promise<{
        time: string;
        available: boolean;
    }[]>;
    findAll(clinicId: string, from: string, to: string, doctorId?: string): Promise<({
        doctor: {
            name: string;
            id: string;
            clinicId: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            title: string;
        } | null;
        treatment: {
            name: string;
            id: string;
            clinicId: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
        } | null;
        contact: {
            name: string | null;
            id: string;
            clinicId: string;
            phone: string | null;
            email: string | null;
            updatedAt: Date | null;
            createdAt: Date | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
        } | null;
    } & {
        status: import("@prisma/client").$Enums.AppointmentStatus;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        doctorId: string | null;
        treatmentId: string | null;
        conversationId: string | null;
        contactId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    })[]>;
    findOne(clinicId: string, id: string): Promise<{
        doctor: {
            name: string;
            id: string;
            clinicId: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            title: string;
        } | null;
        treatment: {
            name: string;
            id: string;
            clinicId: string;
            updatedAt: Date | null;
            active: boolean | null;
            createdAt: Date | null;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
        } | null;
        contact: {
            name: string | null;
            id: string;
            clinicId: string;
            phone: string | null;
            email: string | null;
            updatedAt: Date | null;
            createdAt: Date | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
        } | null;
        history: {
            payload: import("@prisma/client/runtime/library").JsonValue | null;
            id: string;
            createdAt: Date | null;
            appointmentId: string;
            event: string;
        }[];
    } & {
        status: import("@prisma/client").$Enums.AppointmentStatus;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        doctorId: string | null;
        treatmentId: string | null;
        conversationId: string | null;
        contactId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    create(clinicId: string, dto: CreateAppointmentDto): Promise<{
        status: import("@prisma/client").$Enums.AppointmentStatus;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        doctorId: string | null;
        treatmentId: string | null;
        conversationId: string | null;
        contactId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    updateStatus(clinicId: string, id: string, dto: UpdateStatusDto): Promise<{
        status: import("@prisma/client").$Enums.AppointmentStatus;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        doctorId: string | null;
        treatmentId: string | null;
        conversationId: string | null;
        contactId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    reschedule(clinicId: string, id: string, dto: RescheduleDto): Promise<{
        status: import("@prisma/client").$Enums.AppointmentStatus;
        id: string;
        clinicId: string;
        updatedAt: Date | null;
        createdAt: Date | null;
        doctorId: string | null;
        treatmentId: string | null;
        conversationId: string | null;
        contactId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        source: import("@prisma/client").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
}
//# sourceMappingURL=agenda.controller.d.ts.map