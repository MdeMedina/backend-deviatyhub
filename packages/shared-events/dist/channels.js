"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDIS_CHANNELS = void 0;
/**
 * Canales de Redis Pub/Sub estandarizados para Deviaty Hub.
 * Se utilizan nombres en minúsculas con puntos como separadores de dominio.
 */
var REDIS_CHANNELS;
(function (REDIS_CHANNELS) {
    // Autenticación y Usuarios
    REDIS_CHANNELS["USER_INVITED"] = "user.invited";
    REDIS_CHANNELS["USER_CREATED"] = "user.created";
    // Configuración Clínica
    REDIS_CHANNELS["CLINIC_CONFIG_UPDATED"] = "clinic.config.updated";
    REDIS_CHANNELS["INTEGRATION_CONNECTED"] = "integration.connected";
    REDIS_CHANNELS["AGENT_CONFIG_UPDATED"] = "agent.config.updated";
    // Agendamiento y Citas
    REDIS_CHANNELS["APPOINTMENT_SCHEDULED"] = "appointment.scheduled";
    REDIS_CHANNELS["APPOINTMENT_RESCHEDULED"] = "appointment.rescheduled";
    REDIS_CHANNELS["APPOINTMENT_CANCELLED"] = "appointment.cancelled";
    // Operativo e IA
    // Mensaje nuevo en una conversación (entrante del paciente o respuesta del
    // agente). El Core lo reemite por Socket.io para que el panel se actualice
    // solo: sin este canal, los mensajes que escribía el agent-service no
    // llegaban nunca a la interfaz.
    REDIS_CHANNELS["CONVERSATION_MESSAGE"] = "conversation.message";
    REDIS_CHANNELS["CONVERSATION_CLOSED"] = "conversation.closed";
    REDIS_CHANNELS["HUMAN_ESCALATION"] = "human.escalation";
    // Métricas y Analítica
    REDIS_CHANNELS["METRICS_EVENT"] = "metrics.event";
})(REDIS_CHANNELS || (exports.REDIS_CHANNELS = REDIS_CHANNELS = {}));
//# sourceMappingURL=channels.js.map