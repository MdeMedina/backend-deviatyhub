export declare enum ConversationStatusDto {
    OPEN = "OPEN",
    HUMAN_TAKEOVER = "HUMAN_TAKEOVER",
    CLOSED = "CLOSED"
}
export declare class ManualMessageDto {
    content: string;
}
export declare class ConversationFilterDto {
    status?: ConversationStatusDto;
    channel?: string;
    page?: number;
    limit?: number;
}
//# sourceMappingURL=conversation.dto.d.ts.map