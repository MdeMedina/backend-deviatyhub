"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppEvents = void 0;
/**
 * Eventos globales de la aplicación para el EventBus (Redis).
 */
var AppEvents;
(function (AppEvents) {
    // Usuarios
    AppEvents["USER_INVITED"] = "user.invited";
    // Citas
    AppEvents["APPOINTMENT_SCHEDULED"] = "appointment.scheduled";
    // Agente e IA
    AppEvents["HUMAN_ESCALATION"] = "human.escalation";
    AppEvents["INTENTION_DETECTED"] = "intention.detected";
    // Mensajería Outbound
    AppEvents["MESSAGE_OUTBOUND"] = "message.outbound";
    // Métricas
    AppEvents["METRICS_EVENT"] = "metrics.event";
})(AppEvents || (exports.AppEvents = AppEvents = {}));
//# sourceMappingURL=events.js.map