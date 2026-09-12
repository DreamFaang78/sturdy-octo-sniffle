import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API /leads] Supabase error:", error);
      return NextResponse.json({ leads: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leads: data || [] });
  } catch (err: any) {
    console.error("[API /leads] Unexpected error:", err);
    return NextResponse.json({ leads: [], error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const deleteDummy = searchParams.get('dummy') === 'true';
    const deleteAll = searchParams.get('all') === 'true';
    const supabase = createAdminClient();

    if (id) {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Lead ${id} deleted` });
    }

    if (deleteDummy) {
      const { error } = await supabase
        .from('leads')
        .delete()
        .or('phone.eq.+910000000000,phone.eq.+919999900000,name.ilike.%Facebook Lead%');
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Dummy test leads deleted' });
    }

    if (deleteAll) {
      const { error } = await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'All leads deleted' });
    }

    return NextResponse.json({ error: 'Missing id or action parameter' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /leads DELETE] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    // Batch update (e.g. from round-robin distribute)
    if (Array.isArray(body?.updates)) {
      for (const update of body.updates) {
        if (!update.id) continue;
        await supabase
          .from('leads')
          .update({
            assigned_to: update.assigned_to || null,
            assigned_at: update.assigned_at || (update.assigned_to ? new Date().toISOString() : null),
            status: update.status || (update.assigned_to ? 'qualified' : 'unassigned'),
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id);
      }
      return NextResponse.json({ success: true, count: body.updates.length });
    }

    // Single lead update
    const { id, assigned_to, status, next_follow_up_date, next_follow_up_time, order_status, rto_reason } = body;
    if (!id) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (assigned_to !== undefined) {
      updates.assigned_to = assigned_to || null;
      updates.assigned_at = assigned_to ? new Date().toISOString() : null;
    }
    if (status !== undefined) updates.status = status;
    if (next_follow_up_date !== undefined) updates.next_follow_up_date = next_follow_up_date;
    if (next_follow_up_time !== undefined) updates.next_follow_up_time = next_follow_up_time;
    if (order_status !== undefined) updates.order_status = order_status;
    if (rto_reason !== undefined) updates.rto_reason = rto_reason;

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, lead: data });
  } catch (err: any) {
    console.error('[API /leads PATCH] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
