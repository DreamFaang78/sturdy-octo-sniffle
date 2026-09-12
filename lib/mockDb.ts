import { Lead, Profile, LeadNote, StatusHistory, DashboardMetrics, CallerPerformance, LeadIngestionLog, ManualDialLog, PatientCareJourney, WhatsAppTemplate } from './types';



export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'user-admin-1',
    name: 'Agam Singh',
    email: 'agam@hommed.in',
    phone: '+919876543210',
    role: 'admin',
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'user-caller-1',
    name: 'Caller Team',
    email: 'caller@hommed.in',
    phone: '+919876543211',
    role: 'caller',
    is_active: true,
    created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
  },
];

export function getSavedProfiles(): Profile[] {
  if (typeof window === 'undefined') return INITIAL_PROFILES;
  try {
    const saved = localStorage.getItem('hommed_custom_profiles');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return INITIAL_PROFILES;
}

export function saveProfiles(profiles: Profile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('hommed_custom_profiles', JSON.stringify(profiles));
  } catch (e) {}
}


const todayStr = new Date().toISOString().split('T')[0];
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const threeDaysAgoStr = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_NOTES: LeadNote[] = [];

export const INITIAL_INGESTION_LOGS: LeadIngestionLog[] = [];

export const INITIAL_MANUAL_DIAL_LOGS: ManualDialLog[] = [];

export const INITIAL_CARE_JOURNEYS: PatientCareJourney[] = [];

export const INITIAL_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    key: 'order_confirmation',
    label: 'Order Confirmation',
    text_template: 'Hello {{name}}, your order with Hommed Diagnostics has been confirmed! Thank you for choosing us.',
  },
  {
    key: 'diet_chart_reminder',
    label: 'Diet Chart Protocol',
    text_template: 'Hello {{name}}, here is your personalized Hommed diet chart. Please review the guidelines for your care plan.',
  },
  {
    key: 'dispatch_notice',
    label: 'Order Dispatch Notification',
    text_template: 'Hi {{name}}, your order has been dispatched and is on its way! Our team will keep you updated.',
  },
  {
    key: 'followup_day1',
    label: 'Day 1 Nudge',
    text_template: 'Hi {{name}}, following up regarding your health checkup inquiry with Hommed Diagnostics. When is a good time to connect?',
  },
  {
    key: 'followup_day3',
    label: 'Day 3 Nudge',
    text_template: 'Hello {{name}}, just checking in on your requested health package with Hommed. Let us know if you have any questions!',
  },
  {
    key: 'followup_day5',
    label: 'Day 5 Nudge',
    text_template: 'Hi {{name}}, we have special health slots available today! Would you like to schedule your diagnostic package?',
  },
  {
    key: 'followup_day7',
    label: 'Day 7 Final Nudge',
    text_template: 'Hello {{name}}, final check-in regarding your Hommed health checkup inquiry. Let us know if you would like to schedule.',
  },
  {
    key: 'daily_revert',
    label: 'Daily Revert Nudge',
    text_template: 'Hi {{name}}, following up on our previous call. Please reply or let us know when you would like to reconnect!',
  },
];


