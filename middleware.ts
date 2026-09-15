import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-hommed.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key-hommed-crm-2026';

  const pathname = req.nextUrl.pathname;

  // Skip static assets, api routes, and login page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname === '/login' ||
    pathname === '/favicon.ico'
  ) {
    return res;
  }

  // 1. Check Supabase Auth session via cookies
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  // 2. Check local fallback cookie session if Supabase Auth demo session
  const fallbackSessionCookie = req.cookies.get('hommed_user_session')?.value;
  let userRole: 'admin' | 'caller' | null = null;

  if (session?.user) {
    userRole = (session.user.user_metadata?.role || 'caller') as any;
  } else if (fallbackSessionCookie) {
    try {
      const parsed = JSON.parse(fallbackSessionCookie);
      userRole = parsed.role || null;
    } catch (e) {}
  }

  // 3. Unauthenticated protection redirect
  if (!userRole) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Role-based protection rules
  if (pathname.startsWith('/admin') && userRole !== 'admin') {
    // Caller attempting to access admin route -> redirect to /caller
    return NextResponse.redirect(new URL('/caller', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/caller/:path*'],
};
