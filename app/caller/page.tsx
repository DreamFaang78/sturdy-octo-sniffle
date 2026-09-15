'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import WhatsAppModal from '@/components/WhatsAppModal';
import ManualLeadModal from '@/components/ManualLeadModal';
import { 
  PhoneCall, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  PhoneMissed, 
  MessageSquare, 
  Search, 
  ChevronRight,
  Flame,
  Calendar,
  AlertTriangle,
  UserCheck,
  Zap,
  Sparkles,
  Bell,
  BellRing
} from 'lucide-react';
import { Lead, Profile } from '@/lib/types';
import { INITIAL_PROFILES, INITIAL_CARE_JOURNEYS } from '@/lib/mockDb';
import { 
  requestNotificationPermission, 
  sendBrowserNotification, 
  getFollowUpUrgency 
} from '@/lib/notifications';
import { createClient } from '@/lib/supabase/client';
import ReminderNotificationBanner from '@/components/ReminderNotificationBanner';
import LeadNameCell from '@/components/LeadNameCell';

async function fetchLeadsFromApi(callerId?: string): Promise<Lead[]> {
  try {
    const url = callerId ? `/api/leads?callerId=${encodeURIComponent(callerId)}` : '/api/leads';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return json.leads || [];
  } catch {
    return [];
  }
}

// Helper to extract flame flair and clean long lead names cleanly
function formatLeadNameWithFlame(fullName: string) {
  const isHot = fullName.includes('🔥');
  const cleanName = fullName.replace(/🔥+/g, '').trim();

  return (
    <div className="flex items-center space-x-1.5 min-w-0">
      <span className="truncate font-semibold text-white text-sm" title={cleanName}>
        {cleanName}
      </span>
      {isHot && (
        <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded shrink-0">
          🔥 HOT
        </span>
      )}
    </div>
  );
}

export default function CallerDashboard() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[1]); // Default to Caller Team
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | 'qualified' | 'phone_not_picked' | 'useless' | 'converted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [isManualLeadOpen, setIsManualLeadOpen] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);

  // Fetch real leads from API and subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient();

    const loadLeads = async (callerId?: string) => {
      const activeCallerId = callerId || currentUser.id;
      const data = await fetchLeadsFromApi(activeCallerId);
      setLeads(data);
    };

    loadLeads(currentUser.id);

    const channel = supabase
      .channel('caller-dashboard-leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        loadLeads(currentUser.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        loadLeads(currentUser.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser.id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hommed_user_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.role === 'caller') {
            setCurrentUser(parsed);
          }
        } catch (e) {}
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        setNotificationsAllowed(true);
      }
    }
  }, []);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsAllowed(granted);
    if (granted) {
      sendBrowserNotification('Notifications Enabled!', 'You will receive pop-up alerts for high-priority telecaller follow-ups.');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const isLeadAssignedToMe = (l: Lead) => {
    if (!l.assigned_to) return false;
    const assignedStr = String(l.assigned_to).toLowerCase();
    const currentName = currentUser.name.toLowerCase();
    const currentId = currentUser.id.toLowerCase();

    return (
      assignedStr === currentId ||
      assignedStr === currentName ||
      (currentName.includes('haider') && (assignedStr.includes('haider') || assignedStr.includes('1'))) ||
      (currentName.includes('gopi') && (assignedStr.includes('gopi') || assignedStr.includes('2'))) ||
      (currentName.includes('abhishek') && (assignedStr.includes('abhishek') || assignedStr.includes('3')))
    );
  };

  // Leads strictly assigned to this caller
  const myLeads = leads.filter((l) => isLeadAssignedToMe(l));

  // Today's Follow-ups Panel (due today or overdue, plus post-dispatch check-ins)
  const todaysFollowups = myLeads.filter((l) => {
    if (!l.next_follow_up_date || l.next_follow_up_date > todayStr) return false;
    if (l.status === 'useless') return false;
    if (l.status === 'converted') {
      const journey = INITIAL_CARE_JOURNEYS.find((j) => j.lead_id === l.id);
      return journey?.step3_call_task_status === 'pending';
    }
    return true;
  });

  // Filtered Leads according to active tab & search query
  const filteredLeads = myLeads.filter((l) => {
    const matchesTab = selectedTab === 'all' ? true : l.status === selectedTab;
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      (l.campaign && l.campaign.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const handleLeadAdded = (newLead: Lead) => {
    const assignedLead: Lead = {
      ...newLead,
      assigned_to: currentUser.id,
      assigned_at: new Date().toISOString(),
      assignee: currentUser,
    };
    setLeads([assignedLead, ...leads]);
  };

  // Standardized Fixed-Width Status Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'qualified':
        return (
          <span className="w-32 text-center inline-block px-2.5 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-full border border-blue-500/40 whitespace-nowrap shadow-sm">
            Qualified
          </span>
        );
      case 'phone_not_picked':
        return (
          <span className="w-32 text-center inline-block px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full border border-amber-500/40 whitespace-nowrap shadow-sm">
            Not Picked
          </span>
        );
      case 'converted':
        return (
          <span className="w-32 text-center inline-block px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/40 whitespace-nowrap shadow-sm">
            Converted
          </span>
        );
      case 'useless':
        return (
          <span className="w-32 text-center inline-block px-2.5 py-1 bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-full border border-rose-500/40 whitespace-nowrap shadow-sm">
            Useless
          </span>
        );
      default:
        return (
          <span className="w-32 text-center inline-block px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-full border border-slate-700 whitespace-nowrap shadow-sm">
            Unassigned
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole="caller" userName={currentUser.name} onOpenManualLead={() => setIsManualLeadOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome, {currentUser.name} 👋</h1>
            <p className="text-sm text-slate-400 mt-1">Here are your assigned Hommed leads and daily follow-up queue.</p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center space-x-3">
            <button
              onClick={enableNotifications}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
                notificationsAllowed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow'
              }`}
            >
              {notificationsAllowed ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellRing className="w-4 h-4" />}
              <span>{notificationsAllowed ? 'Pop-ups Active' : 'Enable Pop-up Alerts'}</span>
            </button>

            <Link
              href="/caller/dialer"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition hover:scale-[1.02] active:scale-95"
            >
              <Zap className="w-4 h-4 fill-slate-950 animate-bounce" />
              <span>Start High-Speed Focus Dialer</span>
            </Link>
          </div>
        </div>

        {/* TODAY'S FOLLOW-UP CARDS SECTION (STANDARDIZED HEIGHT & ALIGNMENT) */}
        {todaysFollowups.length > 0 && (
          <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-amber-300 font-bold text-base">
                <Clock className="w-5 h-5 animate-pulse" />
                <span>Today&apos;s High-Priority Follow-ups ({todaysFollowups.length})</span>
              </div>
              <span className="text-xs text-amber-400/80 font-mono font-semibold">Precise Revert Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {todaysFollowups.map((lead) => {
                const urgency = getFollowUpUrgency(lead.next_follow_up_date, lead.next_follow_up_time || '10:30 AM');

                return (
                  <div 
                    key={lead.id} 
                    className="bg-slate-900 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between h-[180px] shadow-md hover:border-amber-500/40 transition-all"
                  >
                    <div>
                      {/* Name & Status Row (Truncates Cleanly with LeadNameCell) */}
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <LeadNameCell name={lead.name} className="flex-1 min-w-0" />
                        <div className="shrink-0">{getStatusBadge(lead.status)}</div>
                      </div>

                      {/* Phone Number */}
                      <div className="text-xs text-slate-400 mt-1 font-mono font-medium">
                        {lead.phone}
                      </div>
                      
                      {/* Timing Urgency Tag (Single-line Pill, Fixed Heights) */}
                      <div className="mt-3 flex items-center min-h-[26px]">
                        {lead.status === 'converted' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                            <Clock className="w-3 h-3 shrink-0 text-purple-400" />
                            <span>Task: Post-dispatch check-in</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] uppercase font-mono whitespace-nowrap truncate ${urgency.badgeColor}`}>
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="truncate">{urgency.label}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Standardized Bottom Action Bar (Identical Positions across all Cards) */}
                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between mt-auto">
                      <button
                        onClick={() => setWhatsappLead(lead)}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition"
                        title="Send WhatsApp Nudge"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <Link
                        href={`/caller/leads/${lead.id}`}
                        className="inline-flex items-center justify-center space-x-1 bg-amber-500 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg hover:bg-amber-400 transition shadow shrink-0 min-w-[120px]"
                      >
                        <span>Call & Update</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MY ASSIGNED LEADS LIST SECTION (IMPROVED ALIGNMENT & ZEBRA STRIPING) */}
        <div className="mt-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
              {(['all', 'qualified', 'phone_not_picked', 'converted', 'useless'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                    selectedTab === tab
                      ? 'bg-teal-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                  }`}
                >
                  {tab === 'all'
                    ? `All Assigned (${myLeads.length})`
                    : `${tab.replace(/_/g, ' ')} (${myLeads.filter((l) => l.status === tab).length})`}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient name, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>

          </div>

          {filteredLeads.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 mt-4">
              <PhoneCall className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <div className="text-base font-medium text-slate-200">No leads found in this bucket</div>
              <p className="text-xs text-slate-500 mt-1">Try switching tabs or adjusting search query.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 w-1/4">Patient Name & Phone</th>
                      <th className="py-3.5 px-4 w-1/5">Campaign / Source</th>
                      <th className="py-3.5 px-4 w-36 text-center">Status</th>
                      <th className="py-3.5 px-4 w-28 text-center">Attempts</th>
                      <th className="py-3.5 px-4 w-1/4">Follow-up Schedule & Urgency</th>
                      <th className="py-3.5 px-4 w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredLeads.map((lead) => {
                      const urgency = getFollowUpUrgency(lead.next_follow_up_date, lead.next_follow_up_time || '10:30 AM');

                      return (
                        <tr 
                          key={lead.id} 
                          className="even:bg-slate-900/60 odd:bg-slate-950/90 hover:bg-teal-950/20 transition-colors"
                        >
                          
                          {/* PATIENT NAME & PHONE */}
                          <td className="py-3.5 px-4 align-middle">
                            <LeadNameCell name={lead.name} phone={lead.phone} />
                          </td>

                          {/* CAMPAIGN / SOURCE */}
                          <td className="py-3.5 px-4 align-middle text-slate-300">
                            <div className="font-medium text-slate-200 truncate max-w-[170px]" title={lead.campaign || 'Direct Ad Form'}>
                              {lead.campaign || 'Direct Ad Form'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">{lead.source}</div>
                          </td>

                          {/* STATUS */}
                          <td className="py-3.5 px-4 align-middle text-center">
                            {getStatusBadge(lead.status)}
                            {lead.order_status === 'rto' && (
                              <div className="mt-1">
                                <span className="px-1.5 py-0.5 bg-rose-500/30 text-rose-300 text-[9px] font-bold rounded uppercase tracking-wider">
                                  RTO Flagged
                                </span>
                              </div>
                            )}
                          </td>

                          {/* ATTEMPTS (Uniform Tabular Numbers) */}
                          <td className="py-3.5 px-4 align-middle text-center font-mono font-bold text-slate-200 whitespace-nowrap">
                            {lead.phone_attempt_count || 0} call{lead.phone_attempt_count !== 1 ? 's' : ''}
                          </td>

                          {/* FOLLOW-UP SCHEDULE & URGENCY (Single-line Pill) */}
                          <td className="py-3.5 px-4 align-middle">
                            {lead.next_follow_up_date ? (
                              <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] font-mono uppercase whitespace-nowrap truncate max-w-[200px] ${urgency.badgeColor}`}>
                                <Clock className="w-3 h-3 shrink-0" />
                                <span className="truncate">{urgency.label}</span>
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono">—</span>
                            )}
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 align-middle text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => setWhatsappLead(lead)}
                              className="p-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 rounded-lg transition"
                              title="WhatsApp Message"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            
                            <Link
                              href={`/caller/leads/${lead.id}`}
                              className="inline-flex items-center justify-center space-x-1 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 text-xs font-bold rounded-lg transition border border-teal-500/20 shrink-0"
                            >
                              <span>Open</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* WhatsApp Trigger Modal */}
      <WhatsAppModal
        isOpen={!!whatsappLead}
        onClose={() => setWhatsappLead(null)}
        lead={whatsappLead}
      />

      {/* Manual Lead Modal */}
      <ManualLeadModal
        isOpen={isManualLeadOpen}
        onClose={() => setIsManualLeadOpen(false)}
        onLeadAdded={handleLeadAdded}
      />

      {/* Reminder Notification Banner */}
      <ReminderNotificationBanner currentUser={currentUser} />
    </div>
  );
}
