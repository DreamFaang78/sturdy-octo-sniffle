import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { distributeLeadsEvenly } from '@/lib/assignment';

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Fetch unassigned leads
    const { data: unassignedLeads, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'unassigned');

    if (leadErr) {
      return NextResponse.json({ error: leadErr.message }, { status: 500 });
    }

    if (!unassignedLeads || unassignedLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unassigned leads found in queue.',
        count: 0,
      });
    }

    // Fetch active callers
    const { data: callers, error: callerErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'caller')
      .eq('is_active', true);

    if (callerErr || !callers || callers.length === 0) {
      return NextResponse.json({
        error: 'No active callers available to distribute leads to.',
      }, { status: 400 });
    }

    const { assignedLeads } = distributeLeadsEvenly(unassignedLeads, callers);

    // Update each lead in Supabase and write to dialer_queue
    const now = new Date().toISOString();
    for (const item of assignedLeads) {
      await supabase
        .from('leads')
        .update({
          assigned_to: item.callerId,
          assigned_at: now,
          updated_at: now,
        })
        .eq('id', item.leadId);
    }

    // Group assigned lead IDs by callerId and enqueue into dialer_queue
    const callerGroupMap = new Map<string, string[]>();
    for (const item of assignedLeads) {
      const list = callerGroupMap.get(item.callerId) || [];
      list.push(item.leadId);
      callerGroupMap.set(item.callerId, list);
    }

    const { enqueueLeadsForCaller } = await import('@/lib/dialer');
    for (const [callerId, leadIds] of callerGroupMap.entries()) {
      await enqueueLeadsForCaller(supabase, callerId, leadIds);
    }


    return NextResponse.json({
      success: true,
      message: `Successfully distributed ${assignedLeads.length} leads across ${callers.length} active callers.`,
      distributedCount: assignedLeads.length,
      callerCount: callers.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
