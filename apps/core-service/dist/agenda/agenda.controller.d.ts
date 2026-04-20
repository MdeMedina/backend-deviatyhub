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
        contact: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            name: string | null;
            phone: string | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
        } | null;
        treatment: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            name: string;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
            active: boolean | null;
        } | null;
        doctor: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            name: string;
            active: boolean | null;
            title: string;
        } | null;
    } & {
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
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
        createdAt: Date | null;
        updatedAt: Date | null;
    })[]>;
    findOne(clinicId: string, id: string): Promise<{
        contact: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            name: string | null;
            phone: string | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
        } | null;
        treatment: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            name: string;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
            active: boolean | null;
        } | null;
        doctor: {
            id: string;
            clinicId: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            name: string;
            active: boolean | null;
            title: string;
        } | null;
        history: {
            id: string;
            createdAt: Date | null;
            appointmentId: string;
            event: string;
            payload: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
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
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    create(clinicId: string, dto: CreateAppointmentDto): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
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
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    updateStatus(clinicId: string, id: string, dto: UpdateStatusDto): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
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
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    reschedule(clinicId: string, id: string, dto: RescheduleDto): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
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
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
}
//# sourceMappingURL=agenda.controller.d.ts.map