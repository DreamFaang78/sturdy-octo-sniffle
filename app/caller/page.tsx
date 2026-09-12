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
import { INITIAL_LEADS, INITIAL_PROFILES, INITIAL_CARE_JOURNEYS } from '@/lib/mockDb';
import { 
  requestNotificationPermission, 
  sendBrowserNotification, 
  getFollowUpUrgency 
} from '@/lib/notifications';
import { openWhatsAppAndLogAction } from '@/lib/whatsapp';
import { createClient } from '@/lib/supabase/client';

async function fetchLeadsFromApi(): Promise<Lead[]> {
  try {
    const res = await fetch('/api/leads', { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return json.leads || [];
  } catch {
    return [];
  }
}

export default function CallerDashboard() {

  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[1]); // Default to Priya Sharma
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [selectedTab, setSelectedTab] = useState<'all' | 'qualified' | 'phone_not_picked' | 'useless' | 'converted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [isManualLeadOpen, setIsManualLeadOpen] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);

  // Fetch real leads from API and subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient();

    const loadLeads = async () => {
      const data = await fetchLeadsFromApi();
      if (data.length > 0) {
        setLeads(data);
      }
    };

    loadLeads();

    const channel = supabase
      .channel('caller-dashboard-leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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

  // Leads assigned to this caller
  const myLeads = leads.filter((l) => l.assigned_to === currentUser.id);

  // Today's Follow-ups Panel (due today or overdue, plus post-dispatch check-ins)
  const todaysFollowups = myLeads.filter((l) => {
    if (!l.next_follow_up_date || l.next_follow_up_date > todayStr) return false;
    if (l.status === 'useless') return false;
    if (l.status === 'converted') {
      // Check if there is a pending post-dispatch call task in care journey
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'qualified':
        return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded border border-blue-500/30">Qualified</span>;
      case 'phone_not_picked':
        return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded border border-amber-500/30">Phone Not Picked</span>;
      case 'converted':
        return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded border border-emerald-500/30">Converted</span>;
      case 'useless':
        return <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-xs font-semibold rounded border border-rose-500/30">Useless</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded">Unassigned</span>;
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

        {/* TODAY'S FOLLOW-UP PANEL WITH PRECISE TIMING BADGES */}
        {todaysFollowups.length > 0 && (
          <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-amber-300 font-semibold text-base">
                <Clock className="w-5 h-5 animate-pulse" />
                <span>Today&apos;s High-Priority Follow-ups ({todaysFollowups.length})</span>
              </div>
              <span className="text-xs text-amber-400/80 font-medium">Precise Revert Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {todaysFollowups.map((lead) => {
                const urgency = getFollowUpUrgency(lead.next_follow_up_date, lead.next_follow_up_time || '10:30 AM');

                return (
                  <div key={lead.id} className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between shadow">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-white text-base">{lead.name}</div>
                        {getStatusBadge(lead.status)}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 font-mono">{lead.phone}</div>
                      
                      {/* Precise Timing Tag or Task Type Tag */}
                      <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                        {lead.status === 'converted' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Clock className="w-3 h-3 shrink-0 text-purple-400" />
                            <span>Task: Post-dispatch check-in</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[10px] uppercase font-mono ${urgency.badgeColor}`}>
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{urgency.label}</span>
                          </span>
                        )}
                      </div>

                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        onClick={() => setWhatsappLead(lead)}
                        className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition"
                        title="Send WhatsApp Nudge"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/caller/leads/${lead.id}`}
                        className="inline-flex items-center space-x-1 bg-amber-500 text-slate-950 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-400 transition"
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

        {/* MY ASSIGNED LEADS LIST SECTION */}
        <div className="mt-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            
            <div className="flex items-center space-x-1 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
              {(['all', 'qualified', 'phone_not_picked', 'converted', 'useless'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                    selectedTab === tab
                      ? 'bg-teal-500 text-slate-950 shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab === 'all' ? `All (${myLeads.length})` : `${tab.replace(/_/g, ' ')} (${myLeads.filter(l => l.status === tab).length})`}
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
                      <th className="py-3 px-4">Patient Name & Phone</th>
                      <th className="py-3 px-4">Campaign / Source</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Attempts</th>
                      <th className="py-3 px-4">Follow-up Schedule & Urgency</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLeads.map((lead) => {
                      const urgency = getFollowUpUrgency(lead.next_follow_up_date, lead.next_follow_up_time || '10:30 AM');

                      return (
                        <tr key={lead.id} className="hover:bg-slate-800/40 transition">
                          
                          <td className="py-3.5 px-4 font-medium text-white">
                            <div className="text-sm font-semibold">{lead.name}</div>
                            <div className="text-slate-400 font-mono text-xs">{lead.phone}</div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-300">
                            <div className="font-medium text-slate-200 truncate max-w-[180px]">
                              {lead.campaign || 'Direct Ad Form'}
                            </div>
                            <div className="text-[10px] text-slate-500">{lead.source}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            {getStatusBadge(lead.status)}
                            {lead.order_status === 'rto' && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500/30 text-rose-300 text-[10px] font-bold rounded">RTO Flagged</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {lead.phone_attempt_count} call{lead.phone_attempt_count !== 1 ? 's' : ''}
                          </td>

                          <td className="py-3.5 px-4">
                            {lead.next_follow_up_date ? (
                              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase ${urgency.badgeColor}`}>
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{urgency.label}</span>
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => setWhatsappLead(lead)}
                              className="p-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 rounded-lg transition"
                              title="WhatsApp Message"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            
                            <Link
                              href={`/caller/leads/${lead.id}`}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 text-xs font-semibold rounded-lg transition border border-teal-500/20"
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
    </div>
  );
}
