import { PrismaService } from "@deviaty/shared-prisma";
export declare class AgendaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAvailableSlots(clinicId: string, date: string, treatmentId?: string, doctorId?: string): Promise<{
        time: string;
        available: boolean;
    }[]>;
    findAllAppointments(clinicId: string, from: string, to: string, doctorId?: string): Promise<({
        contact: {
            clinicId: string;
            id: string;
            createdAt: Date | null;
            name: string | null;
            phone: string | null;
            email: string | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
            updatedAt: Date | null;
        } | null;
        treatment: {
            clinicId: string;
            id: string;
            createdAt: Date | null;
            name: string;
            updatedAt: Date | null;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
            active: boolean | null;
        } | null;
        doctor: {
            clinicId: string;
            id: string;
            createdAt: Date | null;
            name: string;
            updatedAt: Date | null;
            active: boolean | null;
            title: string;
        } | null;
    } & {
        clinicId: string;
        id: string;
        conversationId: string | null;
        createdAt: Date | null;
        contactId: string | null;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        updatedAt: Date | null;
        scheduledAt: Date;
        treatmentId: string | null;
        doctorId: string | null;
        contactName: string | null;
        durationMin: number;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    })[]>;
    findOneAppointment(clinicId: string, id: string): Promise<{
        contact: {
            clinicId: string;
            id: string;
            createdAt: Date | null;
            name: string | null;
            phone: string | null;
            email: string | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
            updatedAt: Date | null;
        } | null;
        treatment: {
            clinicId: string;
            id: string;
            createdAt: Date | null;
            name: string;
            updatedAt: Date | null;
            category: string;
            durationAvgMin: number | null;
            encyclopediaRef: string | null;
            active: boolean | null;
        } | null;
        doctor: {
            clinicId: string;
            id: string;
            createdAt: Date | null;
            name: string;
            updatedAt: Date | null;
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
        clinicId: string;
        id: string;
        conversationId: string | null;
        createdAt: Date | null;
        contactId: string | null;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        updatedAt: Date | null;
        scheduledAt: Date;
        treatmentId: string | null;
        doctorId: string | null;
        contactName: string | null;
        durationMin: number;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    createAppointment(clinicId: string, dto: any): Promise<{
        clinicId: string;
        id: string;
        conversationId: string | null;
        createdAt: Date | null;
        contactId: string | null;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        updatedAt: Date | null;
        scheduledAt: Date;
        treatmentId: string | null;
        doctorId: string | null;
        contactName: string | null;
        durationMin: number;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    updateStatus(clinicId: string, id: string, status: string, notes?: string): Promise<{
        clinicId: string;
        id: string;
        conversationId: string | null;
        createdAt: Date | null;
        contactId: string | null;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        updatedAt: Date | null;
        scheduledAt: Date;
        treatmentId: string | null;
        doctorId: string | null;
        contactName: string | null;
        durationMin: number;
        source: import("@deviaty/shared-prisma").$Enums.AppointmentSource;
        externalId: string | null;
        notes: string | null;
        reminder3dSent: boolean | null;
        reminder1dSent: boolean | null;
        reminder1hSent: boolean | null;
    }>;
    reschedule(clinicId: string, id: string, newDate: Date, notes?: string): Promise<{
        clinicId: string;
        id: string;
        conversationId: string | null;
        createdAt: Date | null;
        contactId: string | null;
        status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
        updatedAt: Date | null;
        scheduledAt: Date;
        treatmentId: string | null;
        doctorId: string | null;
        contactName: string | null;
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