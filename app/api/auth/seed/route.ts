import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const SEED_USERS = [
  {
    email: 'agam@hommed.in',
    password: 'password123',
    name: 'Agam Singh',
    role: 'admin' as const,
    phone: '+919876543210',
  },
  {
    email: 'haider@hommed.in',
    password: 'password123',
    name: 'Haider Team',
    role: 'caller' as const,
    phone: '+919876543211',
  },
  {
    email: 'gopi@hommed.in',
    password: 'password123',
    name: 'Gopi Team',
    role: 'caller' as const,
    phone: '+919876543212',
  },
  {
    email: 'abhishek@hommed.in',
    password: 'password123',
    name: 'Abhishek Team',
    role: 'caller' as const,
    phone: '+919876543213',
  },
];

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const supabase = createAdminClient();
    const seeded = [];

    for (const u of SEED_USERS) {
      // 1. Check if auth user already exists by listing users or attempting login/create
      const { data: listData } = await supabase.auth.admin.listUsers();
      let authUser = listData?.users?.find((usr) => usr.email?.toLowerCase() === u.email.toLowerCase());

      if (!authUser) {
        // Create user in auth.users
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name, role: u.role },
        });

        if (createErr) {
          console.warn(`[Auth Seed] Could not create auth user ${u.email}:`, createErr.message);
        } else if (created.user) {
          authUser = created.user;
        }
      } else {
        // Update password & metadata to ensure credentials work
        await supabase.auth.admin.updateUserById(authUser.id, {
          password: u.password,
          user_metadata: { name: u.name, role: u.role },
        });
      }

      const userId = authUser?.id;

      if (userId) {
        // 2. Upsert matching row into public.profiles
        await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: u.email,
            name: u.name,
            role: u.role,
            phone: u.phone,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' });

        seeded.push({ id: userId, email: u.email, role: u.role, name: u.name });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${seeded.length} real accounts in Supabase Auth & profiles.`,
      users: seeded,
    });
  } catch (err: any) {
    console.error('[API /api/auth/seed] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
