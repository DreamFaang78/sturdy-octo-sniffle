'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Lock, Mail, ArrowRight, Activity } from 'lucide-react';
import { INITIAL_PROFILES } from '@/lib/mockDb';

export default function LoginPage() {
  const router = useRouter();
  const [selectedProfileId, setSelectedProfileId] = useState('user-admin-1');
  const [email, setEmail] = useState('agam@hommed.in');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleQuickSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    const found = INITIAL_PROFILES.find((p) => p.id === profileId);
    if (found) {
      setEmail(found.email);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const user = INITIAL_PROFILES.find((p) => p.email.toLowerCase() === email.toLowerCase()) || {
      id: selectedProfileId,
      name: selectedProfileId.includes('admin') ? 'Agam Singh' : 'Team Caller',
      email,
      role: selectedProfileId.includes('admin') ? 'admin' : 'caller',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('hommed_user_session', JSON.stringify(user));
      }
      setLoading(false);

      if (user.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/caller');
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 selection:bg-teal-500 selection:text-slate-950">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-xl mb-3">
          <Activity className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Hommed <span className="text-teal-400 font-light">Lead CRM</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          High-performance lead tracking & automated calling CRM
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
          
          {/* Quick User Picker */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Select User Profile (Demo Login)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {INITIAL_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => handleQuickSelect(profile.id)}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center space-x-2 ${
                    selectedProfileId === profile.id
                      ? 'bg-teal-500/10 border-teal-500 text-teal-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {profile.role === 'admin' ? (
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
                  )}
                  <div className="truncate text-xs">
                    <div className="font-medium truncate">{profile.name}</div>
                    <div className="text-[10px] opacity-75 capitalize">{profile.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center space-x-2 py-2.5 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-sm transition shadow-lg mt-6"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Hommed CRM'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
