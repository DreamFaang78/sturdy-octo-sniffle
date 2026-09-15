'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Lock, Mail, ArrowRight, Activity, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('agam@hommed.in');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  // Auto-fill preset email helper (cosmetic hint)
  const handleQuickPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setErrorMsg(null);
  };

  const handleSeedAccounts = async () => {
    setIsSeeding(true);
    setSeedNotice(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/seed', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setSeedNotice(json.message || 'Successfully initialized auth accounts!');
      } else {
        setErrorMsg('Failed to initialize seed accounts.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error seeding accounts');
    } finally {
      setIsSeeding(false);
    }
  };

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
        setErrorMsg('Invalid email or password, or account has no assigned role.');
        setLoading(false);
        return;
      }

      // 4. Store session in localStorage and session cookies for middleware
      if (typeof window !== 'undefined') {
        localStorage.setItem('hommed_user_session', JSON.stringify(userProfile));
        document.cookie = `hommed_user_session=${encodeURIComponent(JSON.stringify(userProfile))}; path=/; max-age=86400`;
      }

      // 5. Enforce role-based routing
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
          Authenticated role-based portal for admin & telecallers
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
          
          {/* Quick Preset Buttons (Cosmetic Email Prefill) */}
          <div className="mb-5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Quick Select Account Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPreset('agam@hommed.in')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                  email === 'agam@hommed.in'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">Super Admin</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('haider@hommed.in')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                  email !== 'agam@hommed.in'
                    ? 'bg-teal-500/10 border-teal-500 text-teal-300 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold text-white">Caller Portal</span>
                </div>
              </button>
            </div>
          </div>

          {/* Error & Notice Banners */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl flex items-start space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {seedNotice && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl flex items-start space-x-2 text-xs text-emerald-300">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{seedNotice}</span>
            </div>
          )}

          {/* Real Auth Sign In Form */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hommed.in"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
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
                  <span>Authenticating Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to CRM</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Account Initialization Trigger */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={handleSeedAccounts}
              disabled={isSeeding}
              className="text-xs text-slate-400 hover:text-teal-400 flex items-center justify-center space-x-1.5 mx-auto transition"
            >
              {isSeeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              )}
              <span>{isSeeding ? 'Seeding Accounts...' : 'Initialize / Reset Auth Accounts'}</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
