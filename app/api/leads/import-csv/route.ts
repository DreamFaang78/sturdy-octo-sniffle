import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { leads } = await req.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads array provided' }, { status: 400 });
    }

    const supabase = createAdminClient();
    let importedCount = 0;
    let duplicateCount = 0;

    for (const lead of leads) {
      if (!lead.phone) continue;

      // Check if phone already exists
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', lead.phone)
        .limit(1);

      if (existing && existing.length > 0) {
        duplicateCount++;
        continue;
      }

      const newLead = {
        name: lead.name || 'Facebook Lead',
        phone: lead.phone,
        campaign: lead.campaign || 'Facebook Lead Ads (CSV)',
        source: lead.source || 'Facebook Lead Ads',
        form_answers: lead.form_answers || {},
        status: 'unassigned',
        created_at: lead.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insErr } = await supabase.from('leads').insert(newLead);
      if (!insErr) {
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      duplicateCount,
      message: `Successfully imported ${importedCount} leads (${duplicateCount} duplicates skipped).`,
    });
  } catch (err: any) {
    console.error('[CSV Import API Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
