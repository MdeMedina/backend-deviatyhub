/**
 * Canales de Redis Pub/Sub estandarizados para Deviaty Hub.
 * Se utilizan nombres en minúsculas con puntos como separadores de dominio.
 */
export declare enum REDIS_CHANNELS {
    USER_INVITED = "user.invited",
    USER_CREATED = "user.created",
    CLINIC_CONFIG_UPDATED = "clinic.config.updated",
    INTEGRATION_CONNECTED = "integration.connected",
    AGENT_CONFIG_UPDATED = "agent.config.updated",
    APPOINTMENT_SCHEDULED = "appointment.scheduled",
    APPOINTMENT_RESCHEDULED = "appointment.rescheduled",
    APPOINTMENT_CANCELLED = "appointment.cancelled",
    CONVERSATION_CLOSED = "conversation.closed",
    HUMAN_ESCALATION = "human.escalation",
    METRICS_EVENT = "metrics.event"
}
//# sourceMappingURL=channels.d.ts.map