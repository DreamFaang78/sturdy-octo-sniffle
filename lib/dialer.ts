import { SupabaseClient } from '@supabase/supabase-js';

export async function enqueueLeadsForCaller(
  supabase: SupabaseClient,
  callerId: string,
  leadIds: string | string[]
): Promise<number> {
  const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
  if (ids.length === 0 || !callerId) return 0;

  try {
    // 1. Get current max queue_position for this caller
    const { data: maxRow } = await supabase
      .from('dialer_queue')
      .select('queue_position')
      .eq('caller_id', callerId)
      .order('queue_position', { ascending: false })
      .limit(1)
      .maybeSingle();

    let startPos = (maxRow?.queue_position || 0) + 1;

    const rowsToInsert = ids.map((leadId, idx) => ({
      caller_id: callerId,
      lead_id: leadId,
      queue_position: startPos + idx,
      status: 'pending',
      assigned_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('dialer_queue')
      .upsert(rowsToInsert, { onConflict: 'caller_id,lead_id', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('[dialer.ts] Error enqueuing leads:', error);
      return 0;
    }

    return data?.length || ids.length;
  } catch (err) {
    console.error('[dialer.ts] Unexpected error enqueuing leads:', err);
    return 0;
  }
}

export async function getCallerQueue(supabase: SupabaseClient, callerId: string) {
  if (!callerId) return [];

  // Fetch caller's queue ordered strictly by static queue_position ASC
  const { data: queueItems, error: qErr } = await supabase
    .from('dialer_queue')
    .select(`
      id,
      caller_id,
      lead_id,
      queue_position,
      status,
      assigned_at,
      lead:leads (*)
    `)
    .eq('caller_id', callerId)
    .order('queue_position', { ascending: true });

  if (qErr) {
    console.error('[dialer.ts] Error fetching caller queue:', qErr);
    return [];
  }

  return (queueItems || []).map((q: any) => ({
    ...q,
    lead: q.lead || null,
  }));
}

export async function recordCallTap(
  supabase: SupabaseClient,
  callerId: string,
  leadId: string
) {
  if (!leadId) throw new Error('leadId is required');

  // 1. Calculate next attempt_number for this lead from call_log
  const { count: existingAttempts } = await supabase
    .from('call_log')
    .select('*', { count: 'exact', head: true })
    .eq('lead_id', leadId);

  const attemptNumber = (existingAttempts || 0) + 1;

  // 2. Insert call_log event
  const { data: logItem, error: logErr } = await supabase
    .from('call_log')
    .insert({
      caller_id: callerId || null,
      lead_id: leadId,
      called_at: new Date().toISOString(),
      attempt_number: attemptNumber,
    })
    .select()
    .single();

  if (logErr) {
    console.error('[dialer.ts] Error inserting call_log tap event:', logErr);
    throw logErr;
  }

  // 3. Sync attempt count to lead table
  await supabase
    .from('leads')
    .update({
      phone_attempt_count: attemptNumber,
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  return { callLog: logItem, attemptNumber };
}

export async function recordCallOutcome(
  supabase: SupabaseClient,
  callerId: string,
  leadId: string,
  outcome: string,
  outcomeDetails?: string,
  notes?: string
) {
  if (!leadId) throw new Error('leadId is required');

  // 1. Find most recent call_log item for this lead/caller
  const { data: latestLog } = await supabase
    .from('call_log')
    .select('id')
    .eq('lead_id', leadId)
    .order('called_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let targetLogId = latestLog?.id;

  // If no tap log existed prior (e.g. direct outcome click), create a call_log row
  if (!targetLogId) {
    const { count } = await supabase
      .from('call_log')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId);

    const { data: newLog } = await supabase
      .from('call_log')
      .insert({
        caller_id: callerId || null,
        lead_id: leadId,
        called_at: new Date().toISOString(),
        attempt_number: (count || 0) + 1,
        outcome,
        outcome_details: outcomeDetails || null,
        notes: notes || null,
      })
      .select()
      .single();

    targetLogId = newLog?.id;
  } else {
    // Update existing tap log with outcome
    await supabase
      .from('call_log')
      .update({
        outcome,
        outcome_details: outcomeDetails || null,
        notes: notes || null,
      })
      .eq('id', targetLogId);
  }

  // 2. Update dialer_queue status for this caller & lead
  if (callerId) {
    await supabase
      .from('dialer_queue')
      .update({
        status: outcome === 'phone_not_picked' ? 'pending' : 'done',
      })
      .eq('caller_id', callerId)
      .eq('lead_id', leadId);
  }

  return { success: true, logId: targetLogId };
}
