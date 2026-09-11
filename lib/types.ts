export type UserRole = 'admin' | 'caller';

export type LeadStatus = 'unassigned' | 'qualified' | 'phone_not_picked' | 'useless' | 'converted';

export type UselessReason = 'spam' | 'wrong_number' | 'not_interested' | 'out_of_scope' | 'price_issue' | 'other';

export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'rto';

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  campaign?: string;
  form_answers?: Record<string, any>;
  status: LeadStatus;
  useless_reason?: UselessReason | null;
  useless_note?: string | null;
  assigned_to?: string | null;
  assigned_at?: string | null;
  phone_attempt_count: number;
  last_contacted_at?: string | null;
  next_follow_up_date?: string | null; // YYYY-MM-DD
  next_follow_up_time?: string | null; // e.g. "10:30 AM", "02:00 PM"
  follow_up_stage: number;
  is_cold: boolean;
  order_status?: OrderStatus | null;
  rto_reason?: string | null;
  rto_flagged_at?: string | null;
  created_at: string;
  updated_at: string;

  // Joined profile object if loaded
  assignee?: Profile | null;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  author_id?: string | null;
  author_name: string;
  note: string;
  created_at: string;
}

export interface StatusHistory {
  id: string;
  lead_id: string;
  old_status?: LeadStatus | null;
  new_status: LeadStatus;
  old_order_status?: OrderStatus | null;
  new_order_status?: OrderStatus | null;
  changed_by?: string | null;
  changed_by_name: string;
  changed_at: string;
}

export interface WhatsAppTemplate {
  key: string;
  label: string;
  text_template: string;
  updated_at?: string;
}

export interface ManualWhatsAppLog {
  id: string;
  lead_id?: string | null;
  phone: string;
  template_key: string;
  sender_name: string;
  status: 'sent_manual'; // Self-reported by user
  sent_at: string;
}


export interface DashboardMetrics {
  totalLeads: number;
  unassignedLeads: number;
  qualifiedLeads: number;
  phoneNotPickedLeads: number;
  uselessLeads: number;
  convertedLeads: number;
  rtoCount: number;
  overdueFollowups: number;
  conversionRate: number;
  rtoRate: number;
  leadsToday: number;
  leadsThisWeek: number;
}

export interface CallerPerformance {
  callerId: string;
  callerName: string;
  email: string;
  assignedTotal: number;
  qualifiedCount: number;
  phoneNotPickedCount: number;
  convertedCount: number;
  uselessCount: number;
  overdueCount: number;
  conversionRate: number;
}

export interface ManualDialLog {
  id: string;
  caller_id?: string | null;
  caller_name: string;
  phone: string;
  notes?: string | null;
  dialed_at: string;
}

export type IngestionStatus = 'success' | 'duplicate' | 'mapping_error' | 'api_error';

export interface LeadIngestionLog {
  id: string;
  meta_lead_id?: string | null;
  name?: string | null;
  phone?: string | null;
  campaign?: string | null;
  status: IngestionStatus;
  error_detail?: string | null;
  raw_payload?: Record<string, any>;
  created_at: string;
}

export type JourneyStepStatus = 'pending' | 'scheduled' | 'sent' | 'completed' | 'failed';

export interface PatientCareJourney {
  id: string;
  lead_id: string;
  step1_status: JourneyStepStatus;
  step1_sent_at?: string | null;
  step2_diet_chart_url?: string | null;
  step2_status: JourneyStepStatus;
  step2_scheduled_for?: string | null;
  step2_sent_at?: string | null;
  step3_dispatch_status: JourneyStepStatus;
  step3_dispatch_sent_at?: string | null;
  step3_call_task_status: JourneyStepStatus;
  step3_call_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

