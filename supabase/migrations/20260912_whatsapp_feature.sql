-- Migration: Add whatsapp_templates and whatsapp_logs tables
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  message_text TEXT NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default 3 templates for Caller Panel Quick WhatsApp feature
INSERT INTO public.whatsapp_templates (template_type, message_text)
VALUES
  ('not_picked', 'Hello {{name}}, we tried calling you regarding your inquiry with Hommed Diagnostics for {{city}}. Please let us know a suitable time to connect, or reply directly to this message.'),
  ('follow_up', 'Hi {{name}}, following up regarding your health package inquiry with Hommed. We have special slots available today. Would you like to schedule your diagnostic test? Reply YES to confirm.'),
  ('order_confirmed', 'Dear {{name}}, your health package order with Hommed Diagnostics has been successfully confirmed! Our team will coordinate your sample collection for {{city}}. Thank you for choosing Hommed.')
ON CONFLICT (template_type) DO UPDATE SET
  message_text = EXCLUDED.message_text,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT,
  caller_id TEXT,
  template_type TEXT NOT NULL,
  final_message_sent TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  aisensy_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_lead_id ON public.whatsapp_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);
