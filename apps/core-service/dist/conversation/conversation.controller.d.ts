import { ConversationService } from './conversation.service';
import { ConversationFilterDto, ManualMessageDto } from './dto/conversation.dto';
export declare class ConversationController {
    private readonly conversationService;
    constructor(conversationService: ConversationService);
    findAll(clinicId: string, filters: ConversationFilterDto): Promise<{
        data: ({
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
            messages: {
                id: string;
                clinicId: string;
                role: import("@prisma/client").$Enums.MessageRole;
                conversationId: string;
                sentAt: Date | null;
                content: string;
                langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
            }[];
        } & {
            id: string;
            clinicId: string;
            contactId: string | null;
            status: import("@prisma/client").$Enums.ConversationStatus;
            channel: string;
            currentStep: string;
            assignedUserId: string | null;
            startedAt: Date | null;
            closedAt: Date | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            total_pages: number;
        };
    }>;
    findContacts(clinicId: string, search?: string, page?: string, limit?: string): Promise<{
        data: {
            id: string;
            clinicId: string;
            name: string | null;
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
    findOne(clinicId: string, id: string): Promise<{
        appointments: ({
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
        })[];
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
        messages: {
            id: string;
            clinicId: string;
            role: import("@prisma/client").$Enums.MessageRole;
            conversationId: string;
            sentAt: Date | null;
            content: string;
            langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        clinicId: string;
        contactId: string | null;
        status: import("@prisma/client").$Enums.ConversationStatus;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    takeover(clinicId: string, userId: string, id: string): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        status: import("@prisma/client").$Enums.ConversationStatus;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    release(clinicId: string, id: string): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        status: import("@prisma/client").$Enums.ConversationStatus;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    sendMessage(clinicId: string, userId: string, id: string, dto: ManualMessageDto): Promise<{
        id: string;
        clinicId: string;
        role: import("@prisma/client").$Enums.MessageRole;
        conversationId: string;
        sentAt: Date | null;
        content: string;
        langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
}
//# sourceMappingURL=conversation.controller.d.ts.map