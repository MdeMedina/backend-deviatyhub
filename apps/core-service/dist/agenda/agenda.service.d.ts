import { PrismaService } from '@deviaty/shared-prisma';
export declare class AgendaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAvailableSlots(clinicId: string, date: string, treatmentId?: string, doctorId?: string): Promise<{
        time: string;
        available: boolean;
    }[]>;
    findAllAppointments(clinicId: string, from: string, to: string, doctorId?: string): Promise<({
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
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    })[]>;
    findOneAppointment(clinicId: string, id: string): Promise<{
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
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    createAppointment(clinicId: string, dto: any): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    updateStatus(clinicId: string, id: string, status: string, notes?: string): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    reschedule(clinicId: string, id: string, newDate: Date, notes?: string): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        treatmentId: string | null;
        doctorId: string | null;
        conversationId: string | null;
        contactName: string | null;
        scheduledAt: Date;
        durationMin: number;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
}
//# sourceMappingURL=agenda.service.d.ts.map