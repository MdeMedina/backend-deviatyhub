/**
 * Plan de la clínica
 */
export enum ClinicPlan {
  STARTER = 'STARTER',
  PRO = 'PRO',
}

/**
 * Roles de usuario
 */
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  DOCTOR = 'DOCTOR',
}

/**
 * Estado de la conversación
 */
export enum ConversationStatus {
  OPEN = 'OPEN',
  HUMAN_TAKEOVER = 'HUMAN_TAKEOVER',
  CLOSED = 'CLOSED',
}

/**
 * Pasos de la máquina de estados del agente
 */
export enum ConversationStep {
  INICIO = 'inicio',
  ESPERANDO_TRATAMIENTO = 'esperando_tratamiento',
  ESPERANDO_FECHA = 'esperando_fecha',
  ESPERANDO_HORARIO = 'esperando_horario',
  ESPERANDO_DATOS_PERSONALES = 'esperando_datos_personales',
  LISTO_PARA_EJECUCION = 'listo_para_ejecucion',
  SIN_CITAS = 'sin_citas',
  CERRADO = 'cerrado',
}

/**
 * Estado de la cita
 */
export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/**
 * Origen de la cita
 */
export enum AppointmentSource {
  AGENT = 'AGENT',
  HUMAN = 'HUMAN',
  EXTERNAL = 'EXTERNAL',
}

/**
 * Rol del mensaje en el historial
 */
export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  HUMAN = 'HUMAN',
  SYSTEM = 'SYSTEM',
}

/**
 * Tipos de integración disponibles
 */
export enum IntegrationType {
  WHATSAPP = 'WHATSAPP',
  INSTAGRAM = 'INSTAGRAM',
  GOOGLE_CALENDAR = 'GOOGLE_CALENDAR',
  DENTALINK = 'DENTALINK',
  DENTIDESK = 'DENTIDESK',
  GMAIL = 'GMAIL',
}

/**
 * Canales de comunicación
 */
export enum Channel {
  WHATSAPP = 'WHATSAPP',
  INSTAGRAM = 'INSTAGRAM',
}

/**
 * Acciones de auditoría
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Tipos de eventos de métricas
 */
export enum MetricEventType {
  CONVERSATION_STARTED = 'CONVERSATION_STARTED',
  CONVERSATION_CLOSED = 'CONVERSATION_CLOSED',
  APPOINTMENT_SCHEDULED = 'APPOINTMENT_SCHEDULED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  HUMAN_TAKEOVER = 'HUMAN_TAKEOVER',
  OUT_OF_HOURS = 'OUT_OF_HOURS',
  INTENTION_DETECTED = 'INTENTION_DETECTED',
}

/**
 * Tipos de métricas de plataforma
 */
export enum PlatformMetricType {
  AGENT_UPTIME = 'AGENT_UPTIME',
  API_LATENCY = 'API_LATENCY',
  ERROR_RATE = 'ERROR_RATE',
  AGENT_ERRORS = 'AGENT_ERRORS',
}
