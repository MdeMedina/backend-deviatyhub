"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformMetricType = exports.MetricEventType = exports.AuditAction = exports.Channel = exports.IntegrationType = exports.MessageRole = exports.AppointmentSource = exports.AppointmentStatus = exports.ConversationStep = exports.ConversationStatus = exports.UserRole = exports.ClinicPlan = void 0;
/**
 * Plan de la clínica
 */
var ClinicPlan;
(function (ClinicPlan) {
    ClinicPlan["STARTER"] = "STARTER";
    ClinicPlan["PRO"] = "PRO";
})(ClinicPlan || (exports.ClinicPlan = ClinicPlan = {}));
/**
 * Roles de usuario
 */
var UserRole;
(function (UserRole) {
    UserRole["SUPERADMIN"] = "SUPERADMIN";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["OPERATOR"] = "OPERATOR";
    UserRole["DOCTOR"] = "DOCTOR";
})(UserRole || (exports.UserRole = UserRole = {}));
/**
 * Estado de la conversación
 */
var ConversationStatus;
(function (ConversationStatus) {
    ConversationStatus["OPEN"] = "OPEN";
    ConversationStatus["HUMAN_TAKEOVER"] = "HUMAN_TAKEOVER";
    ConversationStatus["CLOSED"] = "CLOSED";
})(ConversationStatus || (exports.ConversationStatus = ConversationStatus = {}));
/**
 * Pasos de la máquina de estados del agente
 */
var ConversationStep;
(function (ConversationStep) {
    ConversationStep["INICIO"] = "inicio";
    ConversationStep["ESPERANDO_TRATAMIENTO"] = "esperando_tratamiento";
    ConversationStep["ESPERANDO_FECHA"] = "esperando_fecha";
    ConversationStep["ESPERANDO_HORARIO"] = "esperando_horario";
    ConversationStep["ESPERANDO_DATOS_PERSONALES"] = "esperando_datos_personales";
    ConversationStep["LISTO_PARA_EJECUCION"] = "listo_para_ejecucion";
    ConversationStep["SIN_CITAS"] = "sin_citas";
    ConversationStep["CERRADO"] = "cerrado";
})(ConversationStep || (exports.ConversationStep = ConversationStep = {}));
/**
 * Estado de la cita
 */
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "PENDING";
    AppointmentStatus["CONFIRMED"] = "CONFIRMED";
    AppointmentStatus["RESCHEDULED"] = "RESCHEDULED";
    AppointmentStatus["CANCELLED"] = "CANCELLED";
    AppointmentStatus["COMPLETED"] = "COMPLETED";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
/**
 * Origen de la cita
 */
var AppointmentSource;
(function (AppointmentSource) {
    AppointmentSource["AGENT"] = "AGENT";
    AppointmentSource["HUMAN"] = "HUMAN";
    AppointmentSource["EXTERNAL"] = "EXTERNAL";
})(AppointmentSource || (exports.AppointmentSource = AppointmentSource = {}));
/**
 * Rol del mensaje en el historial
 */
var MessageRole;
(function (MessageRole) {
    MessageRole["USER"] = "USER";
    MessageRole["ASSISTANT"] = "ASSISTANT";
    MessageRole["HUMAN"] = "HUMAN";
    MessageRole["SYSTEM"] = "SYSTEM";
})(MessageRole || (exports.MessageRole = MessageRole = {}));
/**
 * Tipos de integración disponibles
 */
var IntegrationType;
(function (IntegrationType) {
    IntegrationType["WHATSAPP"] = "WHATSAPP";
    IntegrationType["INSTAGRAM"] = "INSTAGRAM";
    IntegrationType["GOOGLE_CALENDAR"] = "GOOGLE_CALENDAR";
    IntegrationType["DENTALINK"] = "DENTALINK";
    IntegrationType["DENTIDESK"] = "DENTIDESK";
    IntegrationType["GMAIL"] = "GMAIL";
})(IntegrationType || (exports.IntegrationType = IntegrationType = {}));
/**
 * Canales de comunicación
 */
var Channel;
(function (Channel) {
    Channel["WHATSAPP"] = "WHATSAPP";
    Channel["INSTAGRAM"] = "INSTAGRAM";
})(Channel || (exports.Channel = Channel = {}));
/**
 * Acciones de auditoría
 */
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "CREATE";
    AuditAction["UPDATE"] = "UPDATE";
    AuditAction["DELETE"] = "DELETE";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
/**
 * Tipos de eventos de métricas
 */
var MetricEventType;
(function (MetricEventType) {
    MetricEventType["CONVERSATION_STARTED"] = "CONVERSATION_STARTED";
    MetricEventType["CONVERSATION_CLOSED"] = "CONVERSATION_CLOSED";
    MetricEventType["APPOINTMENT_SCHEDULED"] = "APPOINTMENT_SCHEDULED";
    MetricEventType["APPOINTMENT_RESCHEDULED"] = "APPOINTMENT_RESCHEDULED";
    MetricEventType["APPOINTMENT_CANCELLED"] = "APPOINTMENT_CANCELLED";
    MetricEventType["HUMAN_TAKEOVER"] = "HUMAN_TAKEOVER";
    MetricEventType["OUT_OF_HOURS"] = "OUT_OF_HOURS";
    MetricEventType["INTENTION_DETECTED"] = "INTENTION_DETECTED";
})(MetricEventType || (exports.MetricEventType = MetricEventType = {}));
/**
 * Tipos de métricas de plataforma
 */
var PlatformMetricType;
(function (PlatformMetricType) {
    PlatformMetricType["AGENT_UPTIME"] = "AGENT_UPTIME";
    PlatformMetricType["API_LATENCY"] = "API_LATENCY";
    PlatformMetricType["ERROR_RATE"] = "ERROR_RATE";
    PlatformMetricType["AGENT_ERRORS"] = "AGENT_ERRORS";
})(PlatformMetricType || (exports.PlatformMetricType = PlatformMetricType = {}));
//# sourceMappingURL=enums.js.map