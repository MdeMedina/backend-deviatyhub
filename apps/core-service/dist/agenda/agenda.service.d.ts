import { PrismaService } from '@deviaty/shared-prisma';
export declare class AgendaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAvailableSlots(clinicId: string, date: string, treatmentId?: string, doctorId?: string): Promise<{
        time: string;
        available: boolean;
    }[]>;
    findAllAppointments(clinicId: string, from: string, to: string, doctorId?: string): Promise<({
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
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
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
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    })[]>;
    findOneAppointment(clinicId: string, id: string): Promise<{
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
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
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
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    createAppointment(clinicId: string, dto: any): Promise<{
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
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
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    updateStatus(clinicId: string, id: string, status: string, notes?: string): Promise<{
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
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
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    reschedule(clinicId: string, id: string, newDate: Date, notes?: string): Promise<{
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
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
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
}
//# sourceMappingURL=agenda.service.d.ts.map