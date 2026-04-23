/**
 * Eventos globales de la aplicación para el EventBus (Redis).
 */
export enum AppEvents {
  // Usuarios
  USER_INVITED = 'user.invited',
  
  // Citas
  APPOINTMENT_SCHEDULED = 'appointment.scheduled',
  
  // Agente e IA
  HUMAN_ESCALATION = 'human.escalation',
  INTENTION_DETECTED = 'intention.detected',
  
  // Mensajería Outbound
  MESSAGE_OUTBOUND = 'message.outbound',
  
  // Métricas
  METRICS_EVENT = 'metrics.event',
}
