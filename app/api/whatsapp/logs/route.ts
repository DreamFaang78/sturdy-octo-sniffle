import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const searchParams = req.nextUrl.searchParams;
  const leadId = searchParams.get('leadId');

  try {
    let query = supabase
      .from('whatsapp_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ logs: [], error: error.message });
    }

    return NextResponse.json({ logs: data || [] });
  } catch (err: any) {
    return NextResponse.json({ logs: [], error: err.message });
  }
}
