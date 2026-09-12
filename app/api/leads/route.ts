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
