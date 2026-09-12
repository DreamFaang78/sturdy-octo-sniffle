import { WhatsAppTemplateType, WhatsAppTemplateRecord, WhatsAppTemplate } from './types';
import { INITIAL_WHATSAPP_TEMPLATES } from './mockDb';

export const DEFAULT_WHATSAPP_TEMPLATES: Record<WhatsAppTemplateType, { label: string; text: string; campaignName: string }> = {
  not_picked: {
    label: 'Not Picked Message',
    text: 'Hello {{name}}, we tried calling you regarding your inquiry with Hommed Diagnostics for {{city}}. Please let us know a suitable time to connect, or reply directly to this message.',
    campaignName: 'not_picked_notice',
  },
  follow_up: {
    label: 'Follow-Up Message',
    text: 'Hi {{name}}, following up regarding your health package inquiry with Hommed. We have special slots available today. Would you like to schedule your diagnostic test? Reply YES to confirm.',
    campaignName: 'followup_reminder',
  },
  order_confirmed: {
    label: 'Order Confirmed Message',
    text: 'Dear {{name}}, your health package order with Hommed Diagnostics has been successfully confirmed! Our team will coordinate your sample collection for {{city}}. Thank you for choosing Hommed.',
    campaignName: 'order_confirmed_notice',
  },
};

/**
 * Replace all {{variable}} placeholders with lead / custom fields
 */
export function substituteTemplateVariables(
  templateText: string,
  lead: {
    name?: string;
    phone?: string;
    city?: string;
    form_id?: string;
    campaign?: string;
    form_answers?: Record<string, any>;
    [key: string]: any;
  }
): string {
  if (!templateText) return '';

  const formAnswers = lead.form_answers || {};

  // Extract city intelligently
  const rawCity =
    lead.city ||
    formAnswers.city ||
    formAnswers.City ||
    formAnswers.location ||
    formAnswers.Location ||
    formAnswers.address ||
    'your location';

  const rawFormId = lead.form_id || formAnswers.form_id || formAnswers.formId || lead.campaign || 'Direct';

  const lookup: Record<string, string> = {
    name: lead.name || 'Customer',
    phone: lead.phone || '',
    city: String(rawCity),
    form_id: String(rawFormId),
    campaign: lead.campaign || 'Hommed Diagnostics',
    status: lead.status || 'New',
  };

  // Populate from form_answers
  for (const [k, v] of Object.entries(formAnswers)) {
    if (v !== undefined && v !== null) {
      lookup[k.toLowerCase()] = String(v);
      lookup[k] = String(v);
    }
  }

  // Populate any top-level keys
  for (const [k, v] of Object.entries(lead)) {
    if (typeof v === 'string' || typeof v === 'number') {
      lookup[k.toLowerCase()] = String(v);
      lookup[k] = String(v);
    }
  }

  return templateText.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
    const val = lookup[key] ?? lookup[key.toLowerCase()];
    return val !== undefined && val !== null && val !== '' ? String(val) : match;
  });
}

/**
 * Format phone number for AiSensy (standard Indian 91XXXXXXXXXX or international)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  } else if (clean.startsWith('0') && clean.length === 11) {
    clean = '91' + clean.slice(1);
  }
  return clean;
}

export function getWhatsAppTemplate(key: string): WhatsAppTemplate {
  const found = INITIAL_WHATSAPP_TEMPLATES.find((t) => t.key === key);
  return (
    found || {
      key,
      label: key,
      text_template: 'Hello {{name}}, connecting regarding your inquiry with Hommed Diagnostics.',
    }
  );
}

export function renderWhatsAppTemplateText(templateText: string, name?: string, campaign?: string): string {
  return templateText
    .replace(/\{\{name\}\}/gi, name || 'Customer')
    .replace(/\{\{campaign\}\}/gi, campaign || 'Hommed Diagnostics');
}

export function generateWhatsAppWaLink(phone: string, text: string): string {
  const cleanPhone = formatPhoneNumber(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function openWhatsAppAndLogAction(
  leadId: string,
  phone: string,
  templateKey: string,
  textOrLabel?: string,
  callerName = 'Caller',
  name?: string,
  campaign?: string
): string {
  let message = textOrLabel || '';
  const tmpl = INITIAL_WHATSAPP_TEMPLATES.find((t) => t.key === templateKey);
  if (tmpl) {
    message = renderWhatsAppTemplateText(tmpl.text_template, name, campaign);
  }
  const waUrl = generateWhatsAppWaLink(phone, message);
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
  return waUrl;
}
