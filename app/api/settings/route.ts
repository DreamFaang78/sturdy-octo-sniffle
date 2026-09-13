import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('settings').select('*');
    
    if (error) throw error;
    
    // Convert array of {key, value} to an object map
    const settingsMap = data.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>);
    
    return NextResponse.json(settingsMap);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    // Prepare rows for upsert
    const rows = Object.entries(body).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'key' })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
