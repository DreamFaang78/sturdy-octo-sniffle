import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();
    const { name, email, phone, role, password } = body;

    // 1. Create the user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: password || 'password123',
      email_confirm: true
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    // 2. Create the profile
    const profile = {
      id: authData.user.id,
      name,
      email,
      phone: phone || '+919999988888',
      role: role || 'caller',
      is_active: true
    };

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single();

    if (profileError) throw profileError;

    return NextResponse.json(profileData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
