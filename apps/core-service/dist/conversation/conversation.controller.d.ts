import { ConversationService } from './conversation.service';
import { ConversationFilterDto, ManualMessageDto } from './dto/conversation.dto';
export declare class ConversationController {
    private readonly conversationService;
    constructor(conversationService: ConversationService);
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
                role: import("@prisma/client").$Enums.MessageRole;
                conversationId: string;
                sentAt: Date | null;
                langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
            }[];
        } & {
            status: import("@prisma/client").$Enums.ConversationStatus;
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
    findContacts(clinicId: string, search?: string, page?: string, limit?: string): Promise<{
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
            role: import("@prisma/client").$Enums.MessageRole;
            conversationId: string;
            sentAt: Date | null;
            langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        status: import("@prisma/client").$Enums.ConversationStatus;
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    takeover(clinicId: string, userId: string, id: string): Promise<{
        status: import("@prisma/client").$Enums.ConversationStatus;
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
        status: import("@prisma/client").$Enums.ConversationStatus;
        id: string;
        clinicId: string;
        contactId: string | null;
        channel: string;
        currentStep: string;
        assignedUserId: string | null;
        startedAt: Date | null;
        closedAt: Date | null;
    }>;
    sendMessage(clinicId: string, userId: string, id: string, dto: ManualMessageDto): Promise<{
        content: string;
        id: string;
        clinicId: string;
        role: import("@prisma/client").$Enums.MessageRole;
        conversationId: string;
        sentAt: Date | null;
        langchainMeta: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
}
//# sourceMappingURL=conversation.controller.d.ts.map