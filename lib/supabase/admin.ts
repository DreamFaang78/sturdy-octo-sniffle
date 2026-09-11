import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-hommed.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key-hommed-crm-2026';

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
