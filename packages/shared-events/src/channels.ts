/**
 * Canales de Redis Pub/Sub estandarizados para Deviaty Hub.
 * Se utilizan nombres en minúsculas con puntos como separadores de dominio.
 */
export enum REDIS_CHANNELS {
  // Autenticación y Usuarios
  USER_INVITED = 'user.invited',
  
  // Configuración Clínica
  CLINIC_CONFIG_UPDATED = 'clinic.config.updated',
  INTEGRATION_CONNECTED = 'integration.connected',
  AGENT_CONFIG_UPDATED = 'agent.config.updated',
  
  // Agendamiento y Citas
  APPOINTMENT_SCHEDULED = 'appointment.scheduled',
  APPOINTMENT_RESCHEDULED = 'appointment.rescheduled',
  APPOINTMENT_CANCELLED = 'appointment.cancelled',
  
  // Operativo e IA
  CONVERSATION_CLOSED = 'conversation.closed',
  HUMAN_ESCALATION = 'human.escalation',
  
  // Métricas y Analítica
  METRICS_EVENT = 'metrics.event',
}
