-- Hommed Lead CRM Database Schema
-- Supabase Postgres Schema (Fully Idempotent Migration)

-- 1. ENUMS (Safe creation with exception catch for duplicate_object error 42710)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'caller');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('unassigned', 'qualified', 'phone_not_picked', 'useless', 'converted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE useless_reason_enum AS ENUM ('spam', 'wrong_number', 'not_interested', 'out_of_scope', 'price_issue', 'other');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM ('processing', 'shipped', 'delivered', 'rto');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. PROFILES TABLE (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'caller',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Facebook Ads',
    campaign TEXT,
    form_answers JSONB DEFAULT '{}'::jsonb,
    
    -- Status & Lifecycle
    status lead_status NOT NULL DEFAULT 'unassigned',
    useless_reason useless_reason_enum,
    useless_note TEXT,
    
    -- Assignment
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ,
    
    -- Call Tracking & Follow-up Engine
    phone_attempt_count INT NOT NULL DEFAULT 0,
    last_contacted_at TIMESTAMPTZ,
    next_follow_up_date DATE,
    follow_up_stage INT NOT NULL DEFAULT 0, -- 0 (new), 1 (Day 1), 2 (Day 3), 3 (Day 5), 4 (Day 7), 5 (Cold)
    is_cold BOOLEAN NOT NULL DEFAULT false,
    
    -- Order & RTO Tracking (When Status = 'converted')
    order_status order_status_enum,
    rto_reason TEXT,
    rto_flagged_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. LEAD NOTES TABLE
CREATE TABLE IF NOT EXISTS public.lead_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'System',
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. STATUS HISTORY (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    old_status lead_status,
    new_status lead_status NOT NULL,
    old_order_status order_status_enum,
    new_order_status order_status_enum,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_by_name TEXT NOT NULL DEFAULT 'System',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. WHATSAPP TEMPLATES & MANUAL LOGS
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    text_template TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default WhatsApp Templates
INSERT INTO public.whatsapp_templates (key, label, text_template) VALUES
    ('order_confirmation', 'Order Confirmation', 'Hello {{name}}, your order with Hommed Diagnostics has been confirmed! Thank you for choosing us.'),
    ('diet_chart_reminder', 'Diet Chart Protocol', 'Hello {{name}}, here is your personalized Hommed diet chart. Please review the guidelines for your care plan.'),
    ('dispatch_notice', 'Order Dispatch Notification', 'Hi {{name}}, your order has been dispatched and is on its way! Our team will keep you updated.'),
    ('followup_day1', 'Day 1 Nudge', 'Hi {{name}}, following up regarding your health checkup inquiry with Hommed Diagnostics. When is a good time to connect?'),
    ('followup_day3', 'Day 3 Nudge', 'Hello {{name}}, just checking in on your requested health package with Hommed. Let us know if you have any questions!'),
    ('followup_day5', 'Day 5 Nudge', 'Hi {{name}}, we have special health slots available today! Would you like to schedule your diagnostic package?'),
    ('followup_day7', 'Day 7 Final Nudge', 'Hello {{name}}, final check-in regarding your Hommed health checkup inquiry. Let us know if you would like to schedule.'),
    ('daily_revert', 'Daily Revert Nudge', 'Hi {{name}}, following up on our previous call. Please reply or let us know when you would like to reconnect!')
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    text_template = EXCLUDED.text_template,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.whatsapp_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    template_key TEXT NOT NULL,
    sender_name TEXT NOT NULL DEFAULT 'System',
    status TEXT NOT NULL DEFAULT 'sent_manual', -- 'sent_manual'
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 7. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default Settings Insert
INSERT INTO public.settings (key, value) VALUES
    ('aisensy_config', '{"api_key": "", "campaign_name": "welcome_lead", "enabled": false}'::jsonb),
    ('meta_webhook_config', '{"verify_token": "hommed_lead_crm_verify_token_2026", "app_secret": "", "auto_assign": false}'::jsonb),
    ('followup_config', '{"day1": 1, "day2": 3, "day3": 5, "day4": 7}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8. INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_order_status ON public.leads(order_status);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_status_history_lead_id ON public.status_history(lead_id);

-- 9. MANUAL DIAL LOGS (TASK 1)
CREATE TABLE IF NOT EXISTS public.manual_dial_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    caller_name TEXT NOT NULL DEFAULT 'System',
    phone TEXT NOT NULL,
    notes TEXT,
    dialed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. LEAD INGESTION LOG (TASK 2 & TASK 3)
CREATE TABLE IF NOT EXISTS public.lead_ingestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_lead_id TEXT,
    name TEXT,
    phone TEXT,
    campaign TEXT,
    status TEXT NOT NULL, -- 'success', 'duplicate', 'mapping_error', 'api_error'
    error_detail TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PATIENT CARE JOURNEY (TASK 4)
CREATE TABLE IF NOT EXISTS public.patient_care_journey (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    step1_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    step1_sent_at TIMESTAMPTZ,
    step2_diet_chart_url TEXT,
    step2_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'sent', 'failed'
    step2_scheduled_for DATE,
    step2_sent_at TIMESTAMPTZ,
    step3_dispatch_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    step3_dispatch_sent_at TIMESTAMPTZ,
    step3_call_task_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed'
    step3_call_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. ROW LEVEL SECURITY (RLS) POLICIES & RE-RUN SAFETY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_dial_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_ingestion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_care_journey ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles read access" ON public.profiles;
CREATE POLICY "Public profiles read access" ON public.profiles FOR SELECT USING (true);

-- Leads Policies
DROP POLICY IF EXISTS "Admin full access to leads" ON public.leads;
CREATE POLICY "Admin full access to leads" ON public.leads FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Caller read assigned leads" ON public.leads;
CREATE POLICY "Caller read assigned leads" ON public.leads FOR SELECT USING (
    assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Caller update assigned leads" ON public.leads;
CREATE POLICY "Caller update assigned leads" ON public.leads FOR UPDATE USING (
    assigned_to = auth.uid()
);

-- Lead Notes Policies
DROP POLICY IF EXISTS "Admin full access to notes" ON public.lead_notes;
CREATE POLICY "Admin full access to notes" ON public.lead_notes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Caller read notes on assigned leads" ON public.lead_notes;
CREATE POLICY "Caller read notes on assigned leads" ON public.lead_notes FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_notes.lead_id AND assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "Caller insert notes on assigned leads" ON public.lead_notes;
CREATE POLICY "Caller insert notes on assigned leads" ON public.lead_notes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_notes.lead_id AND assigned_to = auth.uid())
);

-- Status History Policies
DROP POLICY IF EXISTS "Admin full access to status history" ON public.status_history;
CREATE POLICY "Admin full access to status history" ON public.status_history FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Caller read status history" ON public.status_history;
CREATE POLICY "Caller read status history" ON public.status_history FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = status_history.lead_id AND assigned_to = auth.uid())
);

-- Settings & Logs Policies
DROP POLICY IF EXISTS "Admin access to settings" ON public.settings;
CREATE POLICY "Admin access to settings" ON public.settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin access to whatsapp_log" ON public.whatsapp_log;
CREATE POLICY "Admin access to whatsapp_log" ON public.whatsapp_log FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin access to manual_dial_logs" ON public.manual_dial_logs;
CREATE POLICY "Admin access to manual_dial_logs" ON public.manual_dial_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin access to lead_ingestion_log" ON public.lead_ingestion_log;
CREATE POLICY "Admin access to lead_ingestion_log" ON public.lead_ingestion_log FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin access to patient_care_journey" ON public.patient_care_journey;
CREATE POLICY "Admin access to patient_care_journey" ON public.patient_care_journey FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Realtime Publication (Safe Add)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_ingestion_log;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
