import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// GET /api/notes?leadId=<leadId>
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = req.nextUrl;
  const leadId = searchParams.get('leadId');

  try {
    let query = supabase
      .from('lead_notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API /notes GET] Supabase error:', error);
      return NextResponse.json({ notes: [], count: 0, error: error.message }, { status: 200 });
    }

    return NextResponse.json({ notes: data || [], count: (data || []).length });
  } catch (err: any) {
    console.error('[API /notes GET] Unexpected error:', err);
    return NextResponse.json({ notes: [], count: 0, error: err.message }, { status: 200 });
  }
}

// POST /api/notes
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { leadId, note, authorId, authorName } = body;

    if (!leadId || !note || !note.trim()) {
      return NextResponse.json(
        { error: 'leadId and a non-empty note are required' },
        { status: 400 }
      );
    }

    const insertPayload: Record<string, any> = {
      lead_id: leadId,
      note: note.trim(),
      author_name: authorName || 'Caller',
      created_at: new Date().toISOString(),
    };

    if (authorId && isUuid(authorId)) {
      insertPayload.author_id = authorId;
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[API /notes POST] Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, note: data });
  } catch (err: any) {
    console.error('[API /notes POST] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
