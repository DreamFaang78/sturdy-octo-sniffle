import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/caller/position?callerId=<callerId>
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = req.nextUrl;
  const callerId = searchParams.get('callerId');

  if (!callerId) {
    return NextResponse.json({ error: 'callerId query param is required' }, { status: 400 });
  }

  try {
    const key = `caller_position_${callerId}`;
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.error('[API /caller/position GET] Supabase error:', error);
      return NextResponse.json({ callerId, leadId: null, error: error.message }, { status: 200 });
    }

    if (data?.value?.current_lead_id) {
      return NextResponse.json({
        callerId,
        leadId: data.value.current_lead_id,
        updatedAt: data.value.updated_at || null,
      });
    }

    return NextResponse.json({ callerId, leadId: null });
  } catch (err: any) {
    console.error('[API /caller/position GET] Unexpected error:', err);
    return NextResponse.json({ callerId, leadId: null, error: err.message }, { status: 500 });
  }
}

// POST /api/caller/position
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { callerId, leadId } = body;

    if (!callerId || !leadId) {
      return NextResponse.json(
        { error: 'callerId and leadId are required' },
        { status: 400 }
      );
    }

    const key = `caller_position_${callerId}`;
    const payload = {
      caller_id: callerId,
      current_lead_id: leadId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key,
        value: payload,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[API /caller/position POST] Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      callerId,
      leadId,
      updatedAt: payload.updated_at,
    });
  } catch (err: any) {
    console.error('[API /caller/position POST] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
