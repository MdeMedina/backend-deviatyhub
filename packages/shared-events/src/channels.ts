/**
 * Canales de Redis Pub/Sub estandarizados para Deviaty Hub.
 * Se utilizan nombres en minúsculas con puntos como separadores de dominio.
 */
export enum REDIS_CHANNELS {
  // Autenticación y Usuarios
  USER_INVITED = 'user.invited',
  USER_CREATED = 'user.created',
  
  // Configuración Clínica
  CLINIC_CONFIG_UPDATED = 'clinic.config.updated',
  INTEGRATION_CONNECTED = 'integration.connected',
  AGENT_CONFIG_UPDATED = 'agent.config.updated',
  
  // Agendamiento y Citas
  APPOINTMENT_SCHEDULED = 'appointment.scheduled',
  APPOINTMENT_RESCHEDULED = 'appointment.rescheduled',
  APPOINTMENT_CANCELLED = 'appointment.cancelled',
  
  // Operativo e IA
  // Mensaje nuevo en una conversación (entrante del paciente o respuesta del
  // agente). El Core lo reemite por Socket.io para que el panel se actualice
  // solo: sin este canal, los mensajes que escribía el agent-service no
  // llegaban nunca a la interfaz.
  CONVERSATION_MESSAGE = 'conversation.message',
  CONVERSATION_CLOSED = 'conversation.closed',
  HUMAN_ESCALATION = 'human.escalation',
  
  // Métricas y Analítica
  METRICS_EVENT = 'metrics.event',
}
