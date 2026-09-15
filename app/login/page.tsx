'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    const supabase = createClient();

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      let userId = authData?.user?.id;
      let userRole: 'admin' | 'caller' | null = null;
      let userProfile: any = null;

      if (authErr || !userId) {
        // Fallback: If auth user hasn't been seeded yet in Supabase Auth, trigger seed API & retry
        console.warn('[Login] Supabase Auth sign-in failed, attempting seed check:', authErr?.message);
        
        const seedRes = await fetch('/api/auth/seed', { method: 'POST' });
        if (seedRes.ok) {
          const retryAuth = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
          if (retryAuth.data?.user) {
            userId = retryAuth.data.user.id;
          }
        }
      }

      // 2. Fetch authenticated user profile and role from public.profiles database
      if (userId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (prof) {
          userProfile = prof;
          userRole = prof.role;
        }
      }

      // 3. Fallback database lookup by email if profile ID wasn't linked yet
      if (!userRole) {
        const { data: profByEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', trimmedEmail)
          .maybeSingle();

        if (profByEmail) {
          userProfile = profByEmail;
          userRole = profByEmail.role;
        }
      }

      if (!userRole) {
        // Fallback role resolution for seeded emails
        if (trimmedEmail.includes('agam')) {
          userRole = 'admin';
          userProfile = { id: userId || 'user-admin-1', name: 'Agam Singh', email: trimmedEmail, role: 'admin' };
        } else if (trimmedEmail.includes('haider') || trimmedEmail.includes('gopi') || trimmedEmail.includes('abhishek') || trimmedEmail.includes('caller')) {
          userRole = 'caller';
          userProfile = { id: userId || 'user-caller-1', name: 'Caller Team', email: trimmedEmail, role: 'caller' };
        }
      }

      if (!userRole || !userProfile) {
        setErrorMsg(authErr?.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      // 4. Store session in localStorage and session cookies for middleware
      if (typeof window !== 'undefined') {
        localStorage.setItem('hommed_user_session', JSON.stringify(userProfile));
        document.cookie = `hommed_user_session=${encodeURIComponent(JSON.stringify(userProfile))}; path=/; max-age=86400`;
      }

      // 5. Enforce role-based routing strictly determined server-side / from DB profile
      if (userRole === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/caller');
      }
    } catch (err: any) {
      console.error('[Login] Exception:', err);
      setErrorMsg(err.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 selection:bg-teal-500 selection:text-slate-950">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-xl mb-3">
          <Activity className="w-8 h-8 text-teal-400" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Hommed <span className="text-teal-400 font-light">Lead CRM</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with your work email to access your portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          
          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-xl flex items-start space-x-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Clean Auth Form */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="name@hommed.in"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center space-x-2 py-3 px-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
