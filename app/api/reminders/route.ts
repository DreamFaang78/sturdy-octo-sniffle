import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = req.nextUrl;
  const callerId = searchParams.get('callerId');
  const leadId = searchParams.get('leadId');
  const status = searchParams.get('status');
  const dueOnly = searchParams.get('dueOnly') === 'true';

  try {
    let query = supabase
      .from('call_reminders')
      .select('*')
      .order('notify_at', { ascending: true });

    if (callerId) {
      // Return reminders assigned to this caller or unassigned
      query = query.or(`caller_id.eq.${callerId},caller_id.is.null`);
    }

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (dueOnly) {
      const nowIso = new Date().toISOString();
      query = query.lte('notify_at', nowIso).eq('status', 'pending');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ reminders: [], error: error.message }, { status: 200 });
    }

    return NextResponse.json({ reminders: data || [] });
  } catch (err: any) {
    return NextResponse.json({ reminders: [], error: err.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { leadId, callerId, callerName, leadName, leadPhone, remindAt, bufferMinutes = 15, note } = body;

    if (!leadId || !remindAt) {
      return NextResponse.json({ error: 'leadId and remindAt timestamp are required' }, { status: 400 });
    }

    const remindDate = new Date(remindAt);
    if (isNaN(remindDate.getTime())) {
      return NextResponse.json({ error: 'Invalid remindAt timestamp' }, { status: 400 });
    }

    // Calculate notify_at (e.g. 15 minutes prior to requested call time)
    const bufferMs = Math.max(0, bufferMinutes) * 60 * 1000;
    const notifyDate = new Date(remindDate.getTime() - bufferMs);
    const notifyAt = notifyDate.toISOString();

    const insertData = {
      lead_id: String(leadId),
      caller_id: callerId || null,
      caller_name: callerName || 'Caller',
      lead_name: leadName || 'Lead',
      lead_phone: leadPhone || '',
      remind_at: remindDate.toISOString(),
      notify_at: notifyAt,
      note: note || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('call_reminders')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update lead's follow up date and time in leads table
    try {
      const dateStr = remindDate.toISOString().split('T')[0];
      const timeStr = remindDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await supabase
        .from('leads')
        .update({
          next_follow_up_date: dateStr,
          next_follow_up_time: timeStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    } catch (e) {
      console.warn('Could not update lead next_follow_up_date:', e);
    }

    return NextResponse.json({ success: true, reminder: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { id, status, snoozeMinutes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Reminder id is required' }, { status: 400 });
    }

    let updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (snoozeMinutes && typeof snoozeMinutes === 'number') {
      const newRemindDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);
      const newNotifyDate = new Date(Date.now() + Math.max(0, snoozeMinutes - 5) * 60 * 1000);

      updateData.remind_at = newRemindDate.toISOString();
      updateData.notify_at = newNotifyDate.toISOString();
      updateData.status = 'pending';
    } else if (status) {
      updateData.status = status;
    }

    const { data, error } = await supabase
      .from('call_reminders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, reminder: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
