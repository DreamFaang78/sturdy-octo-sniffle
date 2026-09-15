'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Users, 
  LayoutDashboard, 
  PackageX, 
  UserCheck, 
  Settings, 
  LogOut, 
  PhoneCall,
  Flame,
  PlusCircle,
  Activity,
  MessageSquare
} from 'lucide-react';

import DialpadWidget from '@/components/DialpadWidget';

import { createClient } from '@/lib/supabase/client';

interface NavbarProps {
  userRole?: 'admin' | 'caller';
  userName?: string;
  onOpenManualLead?: () => void;
}

export default function Navbar({ userRole = 'admin', userName = 'Agam Singh', onOpenManualLead }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDialpadOpen, setIsDialpadOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {}

    if (typeof window !== 'undefined') {
      localStorage.removeItem('hommed_user_session');
      document.cookie = 'hommed_user_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    router.push('/login');
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Role Badge */}
            <div className="flex items-center space-x-3">
              <Link href={userRole === 'admin' ? '/admin/dashboard' : '/caller'} className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-slate-950 text-xl tracking-wider shadow">
                  H
                </div>
                <span className="font-bold text-lg text-slate-100 tracking-tight">
                  Hommed <span className="text-teal-400 font-normal">CRM</span>
                </span>
              </Link>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                userRole === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {userRole === 'admin' ? 'Super Admin' : 'Caller'}
              </span>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {userRole === 'admin' ? (
                <>
                  <Link
                    href="/admin/dashboard"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/admin/dashboard'
                        ? 'bg-slate-800 text-teal-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    href="/admin/leads"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/admin/leads'
                        ? 'bg-slate-800 text-teal-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Leads & Queue</span>
                  </Link>

                  <Link
                    href="/admin/intake-monitor"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/admin/intake-monitor'
                        ? 'bg-slate-800 text-teal-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Intake Monitor</span>
                  </Link>

                  <Link
                    href="/admin/rto"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/admin/rto'
                        ? 'bg-slate-800 text-teal-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <PackageX className="w-4 h-4 text-rose-400" />
                    <span>RTO Tracking</span>
                  </Link>

                  <Link
                    href="/admin/team"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/admin/team'
                        ? 'bg-slate-800 text-teal-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Callers</span>
                  </Link>

                  <Link
                    href="/admin/whatsapp"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/admin/whatsapp'
                        ? 'bg-slate-800 text-teal-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp</span>
                  </Link>

                  <Link
                    href="/admin/settings"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/admin/settings'
                        ? 'bg-slate-800 text-teal-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                </>
              ) : (
                <Link
                  href="/caller"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/caller'
                      ? 'bg-slate-800 text-teal-400 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>My Assigned Leads</span>
                </Link>
              )}
            </nav>

            {/* Right Action & User Profile */}
            <div className="flex items-center space-x-3">
              {/* Dialpad Toggle Button for All Users */}
              <button
                onClick={() => setIsDialpadOpen(!isDialpadOpen)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow border ${
                  isDialpadOpen
                    ? 'bg-teal-500 text-slate-950 border-teal-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-teal-400 border-teal-500/30'
                }`}
                title="Open In-CRM Dialpad"
              >
                <PhoneCall className="w-4 h-4" />
                <span className="hidden sm:inline">Dialpad</span>
              </button>

              {onOpenManualLead && (
                <button
                  onClick={onOpenManualLead}
                  className="inline-flex items-center space-x-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 px-3 py-1.5 rounded-lg font-semibold text-xs transition shadow"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Lead</span>
                </button>
              )}

              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-medium text-slate-200">{userName}</div>
                  <div className="text-[10px] text-slate-400">{userRole === 'admin' ? 'Super Admin' : 'Caller Team'}</div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Floating Persistent Dialpad Widget */}
      <DialpadWidget
        isOpen={isDialpadOpen}
        onClose={() => setIsDialpadOpen(false)}
      />
    </>
  );
}

