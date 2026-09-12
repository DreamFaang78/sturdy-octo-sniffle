-- Migration: Add call_reminders table for scheduled callbacks
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.call_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  caller_id TEXT,
  caller_name TEXT,
  lead_name TEXT,
  lead_phone TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  notify_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'completed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_reminders_notify_at ON public.call_reminders(notify_at);
CREATE INDEX IF NOT EXISTS idx_call_reminders_status ON public.call_reminders(status);
CREATE INDEX IF NOT EXISTS idx_call_reminders_lead_id ON public.call_reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_reminders_caller_id ON public.call_reminders(caller_id);

-- Enable RLS and open policy for CRM
ALTER TABLE public.call_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on call_reminders" ON public.call_reminders FOR ALL USING (true) WITH CHECK (true);
