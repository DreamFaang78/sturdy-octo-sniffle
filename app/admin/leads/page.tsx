'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ManualLeadModal from '@/components/ManualLeadModal';
import WhatsAppModal from '@/components/WhatsAppModal';
import { 
  Users, 
  Search, 
  Zap, 
  UserPlus, 
  ChevronRight, 
  MessageSquare, 
  PhoneCall, 
  Filter,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Lead, Profile } from '@/lib/types';
import { INITIAL_PROFILES } from '@/lib/mockDb';
import { distributeLeadsEvenly } from '@/lib/assignment';
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

export default function AdminLeadsPage() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[0]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [callers, setCallers] = useState<Profile[]>(INITIAL_PROFILES.filter((p) => p.role === 'caller'));
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('all');
  const [selectedCallerFilter, setSelectedCallerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isManualLeadOpen, setIsManualLeadOpen] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
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

  const loadLeads = async () => {
    setIsLoading(true);
    const data = await fetchLeadsFromApi();
    setLeads(data);
    setIsLoading(false);
  };

  // Fetch real leads from Supabase (via server API) + subscribe to new inserts
  useEffect(() => {
    const supabase = createClient();

    loadLeads();

    // Real-time: new lead inserted or updated → refresh list
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Delete single lead
  const handleDeleteLead = async (leadId: string, leadName: string) => {
    if (!confirm(`Are you sure you want to delete lead "${leadName}"?`)) return;
    try {
      const res = await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        showToast(`Lead "${leadName}" deleted successfully.`);
      } else {
        showToast('Failed to delete lead.');
      }
    } catch {
      showToast('Error deleting lead.');
    }
  };

  // Purge all dummy & demo placeholder leads
  const handlePurgeDummyLeads = async () => {
    if (!confirm('Delete all dummy / placeholder test leads? Real leads with valid names will be kept.')) return;
    try {
      const res = await fetch('/api/leads?dummy=true', { method: 'DELETE' });
      if (res.ok) {
        await loadLeads();
        showToast('All placeholder / dummy leads purged successfully.');
      } else {
        showToast('Failed to purge dummy leads.');
      }
    } catch {
      showToast('Error purging dummy leads.');
    }
  };

  // Clear all leads (full reset)
  const handleClearAllLeads = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL leads in the database. Are you sure?')) return;
    try {
      const res = await fetch('/api/leads?all=true', { method: 'DELETE' });
      if (res.ok) {
        setLeads([]);
        showToast('All leads have been permanently cleared.');
      } else {
        showToast('Failed to clear leads.');
      }
    } catch {
      showToast('Error clearing leads.');
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync leads from Facebook Graph API (Yesterday 6 PM to Present)
  const handleSyncFacebookLeads = async (customFormId?: string) => {
    setIsSyncing(true);
    showToast('Connecting to Facebook Graph API & fetching leads since yesterday 6:00 PM...');
    try {
      const url = customFormId ? `/api/leads/sync-facebook?formId=${customFormId}` : '/api/leads/sync-facebook';
      const res = await fetch(url, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        await loadLeads();
        showToast(json.message || `Successfully synced ${json.stats?.leadsInserted || 0} leads from Facebook!`);
      } else {
        const errorMsg = json.error || 'Failed to sync from Facebook';
        showToast(`Sync notice: ${errorMsg}`);
        
        // If listing forms failed due to permissions, prompt user for Form ID directly
        if (!customFormId && confirm(`${errorMsg}\n\nWould you like to sync by entering your Facebook Form ID directly?`)) {
          const formIdInput = prompt('Enter your Facebook Lead Form ID (found in Meta Ads Manager / Instant Forms):');
          if (formIdInput && formIdInput.trim()) {
            await handleSyncFacebookLeads(formIdInput.trim());
          }
        }
      }
    } catch (e) {
      showToast('Network error while syncing leads from Facebook.');
    } finally {
      setIsSyncing(false);
    }
  };

  const unassignedLeads = leads.filter((l) => l.status === 'unassigned');

  // Distribute Evenly (Round Robin)
  const handleDistributeEvenly = () => {
    if (unassignedLeads.length === 0) {
      showToast('No unassigned leads found in queue.');
      return;
    }

    const { updatedLeads } = distributeLeadsEvenly(unassignedLeads, callers);
    const updatedMap = new Map(updatedLeads.map((l) => [l.id, l]));
    const nextLeads = leads.map((l) => updatedMap.get(l.id) || l);

    setLeads(nextLeads);
    showToast(`Distributed ${unassignedLeads.length} leads across ${callers.length} active callers!`);
  };

  // Reassign single lead
  const handleReassignLead = (leadId: string, callerId: string) => {
    const caller = callers.find((c) => c.id === callerId);
    const updated = leads.map((l) => {
      if (l.id === leadId) {
        return {
          ...l,
          assigned_to: callerId || null,
          assigned_at: callerId ? new Date().toISOString() : null,
          assignee: caller || null,
          updated_at: new Date().toISOString(),
        };
      }
      return l;
    });

    setLeads(updated);
    showToast(`Lead reassigned to ${caller ? caller.name : 'Unassigned'}`);
  };

  const handleLeadAdded = (newLead: Lead) => {
    setLeads([newLead, ...leads]);
    showToast('New lead added to unassigned queue!');
  };

  // Filtered Leads
  const filteredLeads = leads.filter((l) => {
    const matchesStatus = selectedStatusTab === 'all' ? true : l.status === selectedStatusTab;
    const matchesCaller =
      selectedCallerFilter === 'all'
        ? true
        : selectedCallerFilter === 'unassigned'
        ? !l.assigned_to
        : l.assigned_to === selectedCallerFilter;
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      (l.campaign && l.campaign.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesCaller && matchesSearch;
  });

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
        return <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs font-semibold rounded">Unassigned</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole="admin" userName={currentUser.name} onOpenManualLead={() => setIsManualLeadOpen(true)} />

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
            <h1 className="text-2xl font-bold text-white tracking-tight">Lead Management & Queue</h1>
            <p className="text-sm text-slate-400 mt-1">Assign leads to callers, monitor status, and manage incoming Facebook Ads leads.</p>
          </div>

          <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleSyncFacebookLeads()}
              disabled={isSyncing}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition"
              title="Fetch and import all Facebook Lead Ad submissions from yesterday 6:00 PM to present"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync from FB (Yesterday 6 PM - Now)'}</span>
            </button>

            <button
              onClick={handlePurgeDummyLeads}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/30 transition"
              title="Delete all placeholder and dummy leads"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Dummy Leads</span>
            </button>

            <button
              onClick={handleClearAllLeads}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/30 transition"
              title="Delete all leads from database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Leads</span>
            </button>

            <button
              onClick={() => setIsManualLeadOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <UserPlus className="w-4 h-4 text-teal-400" />
              <span>Add Manual Lead</span>
            </button>
          </div>
        </div>

        {/* UNASSIGNED LEADS QUEUE PANEL */}
        {unassignedLeads.length > 0 && (
          <div className="mt-6 bg-teal-500/10 border border-teal-500/30 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 text-teal-300 font-bold text-base">
                  <Zap className="w-5 h-5 fill-teal-400" />
                  <span>Unassigned Lead Queue ({unassignedLeads.length} leads waiting)</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  100–150 leads/day come in from Facebook Ads. Click below to distribute them evenly across active callers.
                </p>
              </div>

              <button
                onClick={handleDistributeEvenly}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition shrink-0"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>Distribute Evenly (1-Click Round Robin)</span>
              </button>
            </div>
          </div>
        )}

        {/* FILTERS & SEARCH CONTROLS */}
        <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4">
          
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {(['all', 'unassigned', 'qualified', 'phone_not_picked', 'converted', 'useless'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedStatusTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                  selectedStatusTab === tab
                    ? 'bg-teal-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab === 'all'
                  ? `All (${leads.length})`
                  : `${tab.replace(/_/g, ' ')} (${leads.filter((l) => l.status === tab).length})`}
              </button>
            ))}
          </div>

          {/* Caller Dropdown Filter & Search */}
          <div className="flex items-center space-x-3">
            <select
              value={selectedCallerFilter}
              onChange={(e) => setSelectedCallerFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Callers</option>
              <option value="unassigned">Unassigned Only</option>
              {callers.map((c) => (
                <option key={c.id} value={c.id}>
                  Caller: {c.name}
                </option>
              ))}
            </select>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

        </div>

        {/* LEADS TABLE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Patient & Phone</th>
                  <th className="py-3.5 px-4">Campaign Source</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned Caller</th>
                  <th className="py-3.5 px-4">Next Follow-up</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      {isLoading ? (
                        <div className="flex items-center justify-center space-x-2 text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                          <span>Loading leads from Supabase...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-slate-400 font-semibold text-sm">No leads in queue</div>
                          <div className="text-xs text-slate-500">Incoming Facebook Lead Ads will appear here in real-time.</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const assignedCaller = callers.find((c) => c.id === lead.assigned_to);

                    return (
                      <tr key={lead.id} className="hover:bg-slate-800/40 transition">
                        
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white text-sm">{lead.name}</div>
                          <div className="text-slate-400 font-mono text-xs">{lead.phone}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200 truncate max-w-[180px]">
                            {lead.campaign || 'Direct Lead'}
                          </div>
                          <div className="text-[10px] text-slate-500">{lead.source}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          {getStatusBadge(lead.status)}
                          {lead.order_status === 'rto' && (
                            <span className="ml-1 px-1.5 py-0.5 bg-rose-500/30 text-rose-300 text-[10px] font-bold rounded">
                              RTO
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={lead.assigned_to || ''}
                            onChange={(e) => handleReassignLead(lead.id, e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                          >
                            <option value="">Unassigned</option>
                            {callers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          {lead.next_follow_up_date || '—'}
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => setWhatsappLead(lead)}
                            className="p-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 rounded-lg transition"
                            title="Send WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/caller/leads/${lead.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 text-xs font-semibold rounded-lg transition border border-teal-500/20"
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.name)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Manual Lead Modal */}
      <ManualLeadModal
        isOpen={isManualLeadOpen}
        onClose={() => setIsManualLeadOpen(false)}
        onLeadAdded={handleLeadAdded}
      />

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={!!whatsappLead}
        onClose={() => setWhatsappLead(null)}
        lead={whatsappLead}
      />
    </div>
  );
}
