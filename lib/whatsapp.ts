import { Lead, WhatsAppTemplate, LeadNote } from './types';
import { INITIAL_WHATSAPP_TEMPLATES, INITIAL_NOTES } from './mockDb';

export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`; // Add default country code for India
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

export function getWhatsAppTemplate(key: string): WhatsAppTemplate {
  const found = INITIAL_WHATSAPP_TEMPLATES.find((t) => t.key === key);
  if (found) return found;

  return {
    key,
    label: key.replace(/_/g, ' ').toUpperCase(),
    text_template: `Hello {{name}}, following up regarding your inquiry with Hommed Diagnostics.`,
  };
}

export function renderWhatsAppTemplateText(
  templateText: string,
  leadName?: string,
  campaign?: string
): string {
  const name = leadName || 'Valued Patient';
  const cmp = campaign || 'Hommed Diagnostics';
  return templateText
    .replace(/\{\{\s*name\s*\}\}/g, name)
    .replace(/\{\{\s*campaign\s*\}\}/g, cmp);
}

export function generateWhatsAppWaLink(phone: string, text: string): string {
  const cleanPhone = normalizePhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

export function openWhatsAppAndLogAction(
  leadId: string,
  phone: string,
  templateKey: string,
  templateLabel: string,
  callerName: string = 'Telecaller',
  leadName?: string,
  campaign?: string
): string {
  const tmpl = getWhatsAppTemplate(templateKey);
  const text = renderWhatsAppTemplateText(tmpl.text_template, leadName, campaign);
  const waLink = generateWhatsAppWaLink(phone, text);

  // Record self-reported manual action note
  if (typeof window !== 'undefined') {
    const noteObj: LeadNote = {
      id: `note-wa-manual-${Date.now()}`,
      lead_id: leadId,
      author_id: null,
      author_name: callerName,
      note: `Sent (manual): Dispatched '${templateLabel}' template via wa.me link by ${callerName}. (Self-reported, unverified delivery)`,
      created_at: new Date().toISOString(),
    };
    INITIAL_NOTES.unshift(noteObj);

    window.open(waLink, '_blank', 'noopener,noreferrer');
  }

  return waLink;
}
