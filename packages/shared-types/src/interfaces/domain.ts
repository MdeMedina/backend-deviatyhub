import { 
  ClinicPlan, 
  UserRole, 
  ConversationStatus, 
  ConversationStep, 
  AppointmentStatus, 
  AppointmentSource, 
  MessageRole, 
  IntegrationType, 
  Channel, 
  AuditAction,
  MetricEventType,
  PlatformMetricType
} from '../enums';

export interface IClinic {
  id: string;
  name: string;
  slug: string;
  plan: ClinicPlan;
  active: boolean;
  billing_email: string;
  created_at: Date;
  updated_at: Date;
}

export interface IRole {
  id: string;
  clinic_id: string;
  name: string;
  is_superadmin: boolean;
  permissions: IPermissions;
  created_at: Date;
}

export interface IPermissions {
  knowledge_base?: { view: boolean; edit: boolean };
  agent_actions?:  { view: boolean; edit: boolean };
  simulator?:      { view: boolean };
  metrics?:        { view: boolean };
  integrations?:   { view: boolean };
  security?:       { view: boolean };
  users?:          { view: boolean; edit: boolean; create: boolean; delete: boolean };
  clinic_config?:  { view: boolean; edit: boolean };
  conversations?:  { view: boolean; takeover: boolean };
  agenda?:         { view: boolean; edit: boolean };
}

export interface IUser {
  id: string;
  clinic_id: string;
  email: string;
  password_hash?: string;
  role_id: string;
  role?: IRole;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IClinicIntegration {
  id: string;
  clinic_id: string;
  type: IntegrationType;
  connected: boolean;
  credentials?: any; // Encrypted AES-256
  last_tested_at?: Date;
  last_test_ok?: boolean;
  updated_at: Date;
}

export interface IAgentConfig {
  id: string;
  clinic_id: string;
  actions: {
    schedule:   { active: boolean; channels: Channel[]; integrations: IntegrationType[] };
    reschedule: { active: boolean; channels: Channel[]; integrations: IntegrationType[] };
    cancel:     { active: boolean; channels: Channel[]; integrations: IntegrationType[] };
  };
  updated_at: Date;
}

export interface IDoctor {
  id: string;
  clinic_id: string;
  name: string;
  title: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ITreatment {
  id: string;
  clinic_id: string;
  name: string;
  category: string;
  duration_avg_min?: number;
  encyclopedia_ref?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IAppointment {
  id: string;
  clinic_id: string;
  contact_id?: string;
  treatment_id?: string;
  doctor_id?: string;
  conversation_id?: string;
  contact_name?: string;
  scheduled_at: Date;
  duration_min: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  external_id?: string;
  notes?: string;
  reminder_3d_sent: boolean;
  reminder_1d_sent: boolean;
  reminder_1h_sent: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IConversation {
  id: string;
  clinic_id: string;
  contact_id?: string;
  channel: Channel;
  status: ConversationStatus;
  current_step: ConversationStep;
  assigned_user_id?: string;
  started_at: Date;
  closed_at?: Date;
}

export interface IMessage {
  id: string;
  conversation_id: string;
  clinic_id: string;
  role: MessageRole;
  content: string;
  langchain_meta?: any;
  sent_at: Date;
}

export interface IClinicContact {
  id: string;
  clinic_id: string;
  phone?: string;
  instagram_user?: string;
  name?: string;
  last_interaction_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IMetricEvent {
  id: string;
  clinic_id: string;
  event_type: MetricEventType;
  conversation_id?: string;
  value?: any;
  certainty?: number;
  intention?: string;
  hour_of_day?: number;
  created_at: Date;
}

export interface IAuditLog {
  id: string;
  clinic_id: string;
  user_id: string;
  action: AuditAction;
  entity: string;
  entity_id: string;
  changes: {
    before: any;
    after: any;
  };
  created_at: Date;
}

export interface IJwtPayload {
  userId: string;
  clinicId: string;
  role: UserRole;
  email: string;
  permissions: IPermissions;
  iat?: number;
  exp?: number;
}
