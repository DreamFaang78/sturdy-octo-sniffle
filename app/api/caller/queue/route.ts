import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerQueue, enqueueLeadsForCaller } from '@/lib/dialer';

export const dynamic = 'force-dynamic';

// GET /api/caller/queue?callerId=<callerId>
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const callerId = searchParams.get('callerId');

  if (!callerId) {
    return NextResponse.json({ error: 'callerId query param is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    // 1. Fetch caller's queue from dialer_queue table
    let queue = await getCallerQueue(supabase, callerId);

    // If dialer_queue is empty for caller, backfill from leads table for caller if any exist
    if (queue.length === 0) {
      const { data: callerLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', callerId)
        .order('created_at', { ascending: true });

      if (callerLeads && callerLeads.length > 0) {
        await enqueueLeadsForCaller(
          supabase,
          callerId,
          callerLeads.map((l) => l.id)
        );
        queue = await getCallerQueue(supabase, callerId);
      }
    }

    // 2. Get caller's saved queue position from profile or settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_queue_position')
      .eq('id', callerId)
      .maybeSingle();

    const currentPos = profile?.current_queue_position || 1;

    return NextResponse.json({
      success: true,
      queue,
      currentQueuePosition: currentPos,
    });
  } catch (err: any) {
    console.error('[API /caller/queue GET] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/caller/queue (enqueue or update status)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { callerId, leadIds, status, queuePosition } = body;
    const supabase = createAdminClient();

    if (!callerId) {
      return NextResponse.json({ error: 'callerId is required' }, { status: 400 });
    }

    if (leadIds) {
      const count = await enqueueLeadsForCaller(supabase, callerId, leadIds);
      return NextResponse.json({ success: true, enqueuedCount: count });
    }

    if (body.leadId && status) {
      const { error } = await supabase
        .from('dialer_queue')
        .update({ status })
        .eq('caller_id', callerId)
        .eq('lead_id', body.leadId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (queuePosition !== undefined) {
      await supabase
        .from('profiles')
        .update({ current_queue_position: queuePosition })
        .eq('id', callerId);

      return NextResponse.json({ success: true, queuePosition });
    }

    return NextResponse.json({ error: 'Invalid action payload' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /caller/queue POST] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
