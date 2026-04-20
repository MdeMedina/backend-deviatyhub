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
                role: import("@prisma/client").$Enums.MessageRole;
                content: string;
                langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
            }[];
        } & {
            id: string;
            clinicId: string;
            contactId: string | null;
            channel: string;
            status: import("@prisma/client").$Enums.ConversationStatus;
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
    findContacts(clinicId: string, search?: string, page?: string, limit?: string): Promise<{
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
            role: import("@prisma/client").$Enums.MessageRole;
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
            status: import("@prisma/client").$Enums.AppointmentStatus;
            createdAt: Date | null;
            updatedAt: Date | null;
            conversationId: string | null;
            scheduledAt: Date;
            treatmentId: string | null;
            doctorId: string | null;
            contactName: string | null;
            durationMin: number;
            source: import("@prisma/client").$Enums.AppointmentSource;
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
        status: import("@prisma/client").$Enums.ConversationStatus;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    takeover(clinicId: string, userId: string, id: string): Promise<{
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        status: import("@prisma/client").$Enums.ConversationStatus;
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
        status: import("@prisma/client").$Enums.ConversationStatus;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    sendMessage(clinicId: string, userId: string, id: string, dto: ManualMessageDto): Promise<{
        id: string;
        clinicId: string;
        sentAt: Date | null;
        conversationId: string;
        role: import("@prisma/client").$Enums.MessageRole;
        content: string;
        langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
}
//# sourceMappingURL=conversation.controller.d.ts.map