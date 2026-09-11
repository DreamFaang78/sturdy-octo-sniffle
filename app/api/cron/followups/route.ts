import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const supabase = createAdminClient();

    // Query leads with next_follow_up_date <= today and status in ('qualified', 'phone_not_picked')
    const { data: overdueLeads, error } = await supabase
      .from('leads')
      .select('id, name, phone, status, assigned_to, next_follow_up_date, follow_up_stage')
      .lte('next_follow_up_date', todayStr)
      .in('status', ['qualified', 'phone_not_picked']);

    if (error) {
      console.error('[Followups Cron Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by caller ID
    const callerSummary: Record<string, number> = {};
    (overdueLeads || []).forEach((lead) => {
      if (lead.assigned_to) {
        callerSummary[lead.assigned_to] = (callerSummary[lead.assigned_to] || 0) + 1;
      }
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      dueTodayOrOverdueTotal: overdueLeads?.length || 0,
      callerSummary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
