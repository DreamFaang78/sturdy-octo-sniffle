import { Lead, PatientCareJourney, JourneyStepStatus } from './types';
import { INITIAL_CARE_JOURNEYS } from './mockDb';
import { sendAiSensyWhatsAppMessage } from './aisensy';
import { createAdminClient } from './supabase/admin';

// Get existing care journey or initialize a new one for a converted lead
export function getOrCreateCareJourney(leadId: string): PatientCareJourney {
  let existing = INITIAL_CARE_JOURNEYS.find((j) => j.lead_id === leadId);

  if (!existing) {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    existing = {
      id: `journey-${leadId}`,
      lead_id: leadId,
      step1_status: 'pending',
      step1_sent_at: null,
      step2_diet_chart_url: null,
      step2_status: 'pending',
      step2_scheduled_for: tomorrowStr,
      step2_sent_at: null,
      step3_dispatch_status: 'pending',
      step3_dispatch_sent_at: null,
      step3_call_task_status: 'pending',
      step3_call_completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    INITIAL_CARE_JOURNEYS.unshift(existing);
  }

  return existing;
}

// Step 1: Order Confirmation WhatsApp (Fires immediately upon conversion)
export async function triggerStep1OrderConfirmation(lead: Lead, journey: PatientCareJourney): Promise<PatientCareJourney> {
  if (journey.step1_status === 'sent') return journey;

  const result = await sendAiSensyWhatsAppMessage({
    destinationPhone: lead.phone,
    campaignName: 'order_confirmation',
    userName: lead.name,
    leadId: lead.id,
  });

  const updated: PatientCareJourney = {
    ...journey,
    step1_status: result.success ? 'sent' : 'failed',
    step1_sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  updateJourneyInStore(updated);
  return updated;
}

// Step 2: Attach Diet Chart Image & Send Next Calendar Day WhatsApp
export async function attachDietChartAndSend(
  lead: Lead,
  journey: PatientCareJourney,
  imageUrl: string
): Promise<PatientCareJourney> {
  const result = await sendAiSensyWhatsAppMessage({
    destinationPhone: lead.phone,
    campaignName: 'diet_chart_notification', // AiSensy template with IMAGE header
    userName: lead.name,
    leadId: lead.id,
    mediaUrl: imageUrl,
  });

  const updated: PatientCareJourney = {
    ...journey,
    step2_diet_chart_url: imageUrl,
    step2_status: result.success ? 'sent' : 'failed',
    step2_sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  updateJourneyInStore(updated);
  return updated;
}

// Step 3: Trigger Dispatch WhatsApp + Create Same-Day Caller Check-in Call Task
export async function triggerStep3Dispatch(
  lead: Lead,
  journey: PatientCareJourney
): Promise<PatientCareJourney> {
  const result = await sendAiSensyWhatsAppMessage({
    destinationPhone: lead.phone,
    campaignName: 'dispatch_notification',
    userName: lead.name,
    leadId: lead.id,
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Set lead's next follow-up to today for post-dispatch call
  lead.next_follow_up_date = todayStr;
  lead.next_follow_up_time = '04:00 PM';

  const updated: PatientCareJourney = {
    ...journey,
    step3_dispatch_status: result.success ? 'sent' : 'failed',
    step3_dispatch_sent_at: new Date().toISOString(),
    step3_call_task_status: 'pending',
    updated_at: new Date().toISOString(),
  };

  updateJourneyInStore(updated);
  return updated;
}

// Complete Step 3 Call Task ("Post-dispatch check-in")
export function completeStep3CallTask(journey: PatientCareJourney): PatientCareJourney {
  const updated: PatientCareJourney = {
    ...journey,
    step3_call_task_status: 'completed',
    step3_call_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  updateJourneyInStore(updated);
  return updated;
}

function updateJourneyInStore(journey: PatientCareJourney) {
  const idx = INITIAL_CARE_JOURNEYS.findIndex((j) => j.id === journey.id);
  if (idx !== -1) {
    INITIAL_CARE_JOURNEYS[idx] = journey;
  } else {
    INITIAL_CARE_JOURNEYS.unshift(journey);
  }
}
