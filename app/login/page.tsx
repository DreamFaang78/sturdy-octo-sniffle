'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Lock, Mail, ArrowRight, Activity, Users } from 'lucide-react';
import { INITIAL_PROFILES, getSavedProfiles } from '@/lib/mockDb';
import { Profile } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>(INITIAL_PROFILES);
  const [activeRole, setActiveRole] = useState<'admin' | 'caller'>('admin');
  const [selectedProfileId, setSelectedProfileId] = useState('user-admin-1');
  const [email, setEmail] = useState('agam@hommed.in');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = getSavedProfiles();
    setProfiles(saved);
  }, []);

  const adminProfiles = profiles.filter((p) => p.role === 'admin');
  const callerProfiles = profiles.filter((p) => p.role === 'caller');

  const handleSelectRole = (role: 'admin' | 'caller') => {
    setActiveRole(role);
    if (role === 'admin') {
      const target = adminProfiles[0] || INITIAL_PROFILES[0];
      setSelectedProfileId(target.id);
      setEmail(target.email);
    } else {
      const target = callerProfiles[0] || INITIAL_PROFILES[1];
      setSelectedProfileId(target.id);
      setEmail(target.email);
    }
  };

  const handleCallerSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    const found = callerProfiles.find((p) => p.id === profileId);
    if (found) {
      setEmail(found.email);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const user = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase() || p.id === selectedProfileId) || {
      id: selectedProfileId,
      name: activeRole === 'admin' ? 'Agam Singh' : 'Calling Team',
      email,
      role: activeRole,
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
    }, 300);
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
          
          {/* 2-Role Selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Select Access Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectRole('admin')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  activeRole === 'admin'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-semibold shadow-lg shadow-amber-950/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <ShieldCheck className={`w-5 h-5 ${activeRole === 'admin' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Admin</span>
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Super Admin</div>
                  <div className="text-[11px] text-slate-400 truncate">Agam Singh</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('caller')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  activeRole === 'caller'
                    ? 'bg-teal-500/10 border-teal-500 text-teal-300 font-semibold shadow-lg shadow-teal-950/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <UserCheck className={`w-5 h-5 ${activeRole === 'caller' ? 'text-teal-400' : 'text-slate-500'}`} />
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Calling</span>
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Caller Portal</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {callerProfiles.length > 1 ? `${callerProfiles.length} Callers` : 'Calling Team'}
                  </div>
                </div>
              </button>
            </div>

            {/* Caller Member Picker (if more than 1 caller profile exists) */}
            {activeRole === 'caller' && callerProfiles.length > 1 && (
              <div className="mt-3">
                <label className="block text-[11px] text-slate-400 mb-1">Select Caller Member</label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => handleCallerSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {callerProfiles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
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
              className={`w-full flex justify-center items-center space-x-2 py-2.5 px-4 font-semibold rounded-lg text-sm transition shadow-lg mt-6 ${
                activeRole === 'admin'
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-teal-500 hover:bg-teal-400 text-slate-950'
              }`}
            >
              <span>{loading ? 'Authenticating...' : `Sign In as ${activeRole === 'admin' ? 'Admin' : 'Caller'}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}

