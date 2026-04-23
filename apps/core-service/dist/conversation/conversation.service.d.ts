import { PrismaService } from '@deviaty/shared-prisma';
import { ConversationFilterDto } from './dto/conversation.dto';
export declare class ConversationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(clinicId: string, filters: ConversationFilterDto): Promise<{
        data: ({
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
            messages: {
                content: string;
                id: string;
                clinicId: string;
                role: import("@deviaty/shared-prisma").$Enums.MessageRole;
                conversationId: string;
                sentAt: Date | null;
                langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
            }[];
        } & {
            status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
            id: string;
            clinicId: string;
            contactId: string | null;
            channel: string;
            currentStep: string;
            assignedUserId: string | null;
            startedAt: Date | null;
            closedAt: Date | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            total_pages: number;
        };
    }>;
    findOne(clinicId: string, id: string): Promise<{
        appointments: ({
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
        })[];
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
        messages: {
            content: string;
            id: string;
            clinicId: string;
            role: import("@deviaty/shared-prisma").$Enums.MessageRole;
            conversationId: string;
            sentAt: Date | null;
            langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    takeover(clinicId: string, id: string, userId: string): Promise<{
        status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    release(clinicId: string, id: string): Promise<{
        status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    sendManualMessage(clinicId: string, id: string, userId: string, content: string): Promise<{
        content: string;
        id: string;
        clinicId: string;
        role: import("@deviaty/shared-prisma").$Enums.MessageRole;
        conversationId: string;
        sentAt: Date | null;
        langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    findContacts(clinicId: string, search?: string, page?: number, limit?: number): Promise<{
        data: {
            name: string | null;
            id: string;
            clinicId: string;
            phone: string | null;
            email: string | null;
            updatedAt: Date | null;
            createdAt: Date | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            total_pages: number;
        };
    }>;
}
//# sourceMappingURL=conversation.service.d.ts.map