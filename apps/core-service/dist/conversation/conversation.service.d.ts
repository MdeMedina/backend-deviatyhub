import { PrismaService } from '@deviaty/shared-prisma';
import { ConversationFilterDto } from './dto/conversation.dto';
export declare class ConversationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(clinicId: string, filters: ConversationFilterDto): Promise<{
        data: ({
            contact: {
                id: string;
                clinicId: string;
                name: string | null;
                phone: string | null;
                instagramUser: string | null;
                lastInteractionAt: Date | null;
                createdAt: Date | null;
                updatedAt: Date | null;
            } | null;
            messages: {
                id: string;
                clinicId: string;
                sentAt: Date | null;
                conversationId: string;
                role: import("@deviaty/shared-prisma").$Enums.MessageRole;
                content: string;
                langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
            }[];
        } & {
            id: string;
            clinicId: string;
            contactId: string | null;
            channel: string;
            status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
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
        contact: {
            id: string;
            clinicId: string;
            name: string | null;
            phone: string | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
            createdAt: Date | null;
            updatedAt: Date | null;
        } | null;
        messages: {
            id: string;
            clinicId: string;
            sentAt: Date | null;
            conversationId: string;
            role: import("@deviaty/shared-prisma").$Enums.MessageRole;
            content: string;
            langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        appointments: ({
            treatment: {
                id: string;
                clinicId: string;
                name: string;
                createdAt: Date | null;
                updatedAt: Date | null;
                category: string;
                durationAvgMin: number | null;
                encyclopediaRef: string | null;
                active: boolean | null;
            } | null;
            doctor: {
                id: string;
                clinicId: string;
                name: string;
                createdAt: Date | null;
                updatedAt: Date | null;
                active: boolean | null;
                title: string;
            } | null;
        } & {
            id: string;
            clinicId: string;
            contactId: string | null;
            status: import("@deviaty/shared-prisma").$Enums.AppointmentStatus;
            createdAt: Date | null;
            updatedAt: Date | null;
            conversationId: string | null;
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
        })[];
    } & {
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    takeover(clinicId: string, id: string, userId: string): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    release(clinicId: string, id: string): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        status: import("@deviaty/shared-prisma").$Enums.ConversationStatus;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    sendManualMessage(clinicId: string, id: string, userId: string, content: string): Promise<{
        id: string;
        clinicId: string;
        sentAt: Date | null;
        conversationId: string;
        role: import("@deviaty/shared-prisma").$Enums.MessageRole;
        content: string;
        langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    findContacts(clinicId: string, search?: string, page?: number, limit?: number): Promise<{
        data: {
            id: string;
            clinicId: string;
            name: string | null;
            phone: string | null;
            instagramUser: string | null;
            lastInteractionAt: Date | null;
            createdAt: Date | null;
            updatedAt: Date | null;
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