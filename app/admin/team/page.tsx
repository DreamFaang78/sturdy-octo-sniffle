'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { 
  UserCheck, 
  UserPlus, 
  Mail, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  User,
  Power
} from 'lucide-react';
import { Profile } from '@/lib/types';
import { INITIAL_PROFILES } from '@/lib/mockDb';

export default function TeamManagementPage() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[0]);
  const [profiles, setProfiles] = useState<Profile[]>(INITIAL_PROFILES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('password123');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hommed_user_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.role === 'admin') {
            setCurrentUser(parsed);
          }
        } catch (e) {}
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleToggleActive = (profileId: string) => {
    const updated = profiles.map((p) => {
      if (p.id === profileId) {
        return { ...p, is_active: !p.is_active };
      }
      return p;
    });
    setProfiles(updated);
    showToast('Caller user status updated.');
  };

  const handleCreateCaller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    const created: Profile = {
      id: `user-caller-${Date.now()}`,
      name: newName,
      email: newEmail,
      phone: newPhone || '+919999988888',
      role: 'caller',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setProfiles([...profiles, created]);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setIsModalOpen(false);
    showToast(`Caller account created for ${created.name}!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole="admin" userName={currentUser.name} />

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-teal-500 text-slate-950 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Caller User Accounts</h1>
            <p className="text-sm text-slate-400 mt-1">Manage the 3 calling team members and Super Admin access.</p>
          </div>

          <div className="mt-4 md:mt-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition shadow"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Caller Account</span>
            </button>
          </div>
        </div>

        {/* TEAM MEMBERS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {profiles.map((profile) => (
            <div key={profile.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-xl ${profile.role === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'bg-teal-500/20 text-teal-300'}`}>
                      {profile.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{profile.name}</h3>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">{profile.role === 'admin' ? 'Super Admin' : 'Calling Team'}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    profile.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{profile.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{profile.phone || '+919876543210'}</span>
                  </div>
                </div>
              </div>

              {profile.role !== 'admin' && (
                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => handleToggleActive(profile.id)}
                    className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      profile.is_active
                        ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{profile.is_active ? 'Deactivate User' : 'Activate User'}</span>
                  </button>
                </div>
              )}

            </div>
          ))}
        </div>

      </main>

      {/* CREATE CALLER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Create New Caller Account</h3>
            <p className="text-xs text-slate-400 mb-4">No self-signup — Super Admin creates caller accounts directly.</p>

            <form onSubmit={handleCreateCaller} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="vikram@hommed.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg transition shadow"
                >
                  Create Caller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
