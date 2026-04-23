import { MetricEventType, Channel } from '../enums';

export interface IRedisEvent<T = any> {
  id: string;
  source: string;
  timestamp: string;
  channel: string;
  payload: T;
}

export interface IAppointmentScheduledEvent {
  clinicId: string;
  appointmentId: string;
  conversationId: string;
  scheduledAt: string;
  doctorName: string;
  treatmentName: string;
  contactName: string;
  channel: Channel;
}

export interface IHumanEscalationEvent {
  clinicId: string;
  conversationId: string;
  contactName: string;
  channel: Channel;
  lastMessage?: string;
}

export interface IMetricEventPayload {
  clinicId: string;
  type: MetricEventType;
  conversationId?: string;
  value?: any;
}

export interface IMessageOutboundEvent {
  conversationId: string;
  clinicId: string;
  recipient: string; // E.164 phone number
  content: string;
  channel: Channel;
  metadata?: any;
}
