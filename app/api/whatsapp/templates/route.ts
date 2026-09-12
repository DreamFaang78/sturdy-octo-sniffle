import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_WHATSAPP_TEMPLATES } from '@/lib/whatsapp';
import { WhatsAppTemplateType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('template_type', { ascending: true });

    if (error || !data || data.length === 0) {
      // Return defaults formatted
      const defaultList = (['not_picked', 'follow_up', 'order_confirmed'] as WhatsAppTemplateType[]).map((type) => ({
        id: `default-${type}`,
        template_type: type,
        message_text: DEFAULT_WHATSAPP_TEMPLATES[type].text,
        updated_at: new Date().toISOString(),
      }));
      return NextResponse.json({ templates: defaultList, source: 'default' });
    }

    // Merge any missing template types
    const existingTypes = new Set(data.map((d: any) => d.template_type));
    const merged = [...data];
    (['not_picked', 'follow_up', 'order_confirmed'] as WhatsAppTemplateType[]).forEach((type) => {
      if (!existingTypes.has(type)) {
        merged.push({
          id: `default-${type}`,
          template_type: type,
          message_text: DEFAULT_WHATSAPP_TEMPLATES[type].text,
          updated_at: new Date().toISOString(),
        });
      }
    });

    return NextResponse.json({ templates: merged, source: 'supabase' });
  } catch (err: any) {
    const defaultList = (['not_picked', 'follow_up', 'order_confirmed'] as WhatsAppTemplateType[]).map((type) => ({
      id: `default-${type}`,
      template_type: type,
      message_text: DEFAULT_WHATSAPP_TEMPLATES[type].text,
      updated_at: new Date().toISOString(),
    }));
    return NextResponse.json({ templates: defaultList, source: 'fallback', error: err.message });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { template_type, message_text, updated_by } = body;

    if (!template_type || !message_text) {
      return NextResponse.json({ error: 'template_type and message_text are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('whatsapp_templates')
      .upsert(
        {
          template_type,
          message_text,
          updated_by: updated_by || 'Admin',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'template_type' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
