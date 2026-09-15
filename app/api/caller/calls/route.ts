import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordCallTap, recordCallOutcome } from '@/lib/dialer';

export const dynamic = 'force-dynamic';

// GET /api/caller/calls?leadId=<leadId> OR ?callerId=<callerId>&today=true
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const leadId = searchParams.get('leadId');
  const callerId = searchParams.get('callerId');
  const today = searchParams.get('today') === 'true';
  const supabase = createAdminClient();

  try {
    if (leadId) {
      const { data, error } = await supabase
        .from('call_log')
        .select('*')
        .eq('lead_id', leadId)
        .order('called_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, calls: data || [] });
    }

    if (callerId && today) {
      // Local today start (midnight local)
      const now = new Date();
      const localTodayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // 1. Total call taps today from call_log
      const { count: callsTodayCount, error: callsErr } = await supabase
        .from('call_log')
        .select('*', { count: 'exact', head: true })
        .eq('caller_id', callerId)
        .gte('called_at', localTodayStart);

      if (callsErr) throw callsErr;

      // 2. Total converted calls today from call_log
      const { count: convertedTodayCount } = await supabase
        .from('call_log')
        .select('*', { count: 'exact', head: true })
        .eq('caller_id', callerId)
        .eq('outcome', 'converted')
        .gte('called_at', localTodayStart);

      // 3. Queue left (pending items in dialer_queue)
      const { count: queueLeftCount } = await supabase
        .from('dialer_queue')
        .select('*', { count: 'exact', head: true })
        .eq('caller_id', callerId)
        .eq('status', 'pending');

      return NextResponse.json({
        success: true,
        callsTodayCount: callsTodayCount || 0,
        convertedTodayCount: convertedTodayCount || 0,
        queueLeftCount: queueLeftCount || 0,
      });
    }

    return NextResponse.json({ error: 'Missing leadId or callerId query param' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /caller/calls GET] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/caller/calls
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, callerId, leadId, outcome, outcomeDetails, notes } = body;
    const supabase = createAdminClient();

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Action 1: Tap to Call press event
    if (action === 'tap') {
      const result = await recordCallTap(supabase, callerId, leadId);
      return NextResponse.json({
        success: true,
        attemptNumber: result.attemptNumber,
        callLog: result.callLog,
      });
    }

    // Action 2: Outcome logging event
    if (action === 'outcome' || outcome) {
      const result = await recordCallOutcome(
        supabase,
        callerId,
        leadId,
        outcome,
        outcomeDetails,
        notes
      );
      return NextResponse.json({
        success: true,
        logId: result.logId,
      });
    }

    return NextResponse.json({ error: 'Invalid action or missing outcome' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /caller/calls POST] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
