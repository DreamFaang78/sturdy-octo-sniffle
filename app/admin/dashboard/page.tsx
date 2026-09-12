'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ManualLeadModal from '@/components/ManualLeadModal';
import { 
  Users, 
  TrendingUp, 
  PackageX, 
  Clock, 
  UserCheck, 
  PlusCircle, 
  ArrowRight, 
  CheckCircle2, 
  PhoneMissed,
  Activity,
  Flame,
  Zap
} from 'lucide-react';
import { Lead, Profile, CallerPerformance } from '@/lib/types';
import { INITIAL_LEADS, INITIAL_PROFILES } from '@/lib/mockDb';
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

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[0]); // Default Agam Singh
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [callers, setCallers] = useState<Profile[]>(INITIAL_PROFILES.filter((p) => p.role === 'caller'));
  const [isManualLeadOpen, setIsManualLeadOpen] = useState(false);
  const [distributeToast, setDistributeToast] = useState<string | null>(null);

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
      .channel('admin-dashboard-leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculated Metrics
  const totalLeads = leads.length;
  const unassignedCount = leads.filter((l) => l.status === 'unassigned').length;
  const qualifiedCount = leads.filter((l) => l.status === 'qualified').length;
  const phoneNotPickedCount = leads.filter((l) => l.status === 'phone_not_picked').length;
  const uselessCount = leads.filter((l) => l.status === 'useless').length;
  const convertedCount = leads.filter((l) => l.status === 'converted').length;
  const rtoCount = leads.filter((l) => l.order_status === 'rto').length;
  const overdueCount = leads.filter(
    (l) => l.next_follow_up_date && l.next_follow_up_date <= todayStr && l.status !== 'converted' && l.status !== 'useless'
  ).length;

  const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;
  const rtoRate = convertedCount > 0 ? Math.round((rtoCount / convertedCount) * 100) : 0;

  // Caller Performance Matrix
  const callerPerformance: CallerPerformance[] = callers.map((caller) => {
    const assigned = leads.filter((l) => l.assigned_to === caller.id);
    const conv = assigned.filter((l) => l.status === 'converted').length;
    const qual = assigned.filter((l) => l.status === 'qualified').length;
    const pnp = assigned.filter((l) => l.status === 'phone_not_picked').length;
    const useless = assigned.filter((l) => l.status === 'useless').length;
    const overdue = assigned.filter(
      (l) => l.next_follow_up_date && l.next_follow_up_date <= todayStr && l.status !== 'converted' && l.status !== 'useless'
    ).length;

    return {
      callerId: caller.id,
      callerName: caller.name,
      email: caller.email,
      assignedTotal: assigned.length,
      qualifiedCount: qual,
      phoneNotPickedCount: pnp,
      convertedCount: conv,
      uselessCount: useless,
      overdueCount: overdue,
      conversionRate: assigned.length > 0 ? Math.round((conv / assigned.length) * 100) : 0,
    };
  });

  // 1-Click Distribute Action
  const handleDistributeEvenly = () => {
    const unassigned = leads.filter((l) => l.status === 'unassigned');
    if (unassigned.length === 0) {
      setDistributeToast('No unassigned leads found in queue!');
      setTimeout(() => setDistributeToast(null), 3000);
      return;
    }

    const { updatedLeads } = distributeLeadsEvenly(unassigned, callers);

    // Merge updated leads with existing
    const updatedLeadMap = new Map(updatedLeads.map((l) => [l.id, l]));
    const nextLeads = leads.map((l) => updatedLeadMap.get(l.id) || l);

    setLeads(nextLeads);
    setDistributeToast(`Distributed ${unassigned.length} leads evenly across ${callers.length} active callers!`);
    setTimeout(() => setDistributeToast(null), 3500);
  };

  const handleLeadAdded = (newLead: Lead) => {
    setLeads([newLead, ...leads]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole="admin" userName={currentUser.name} onOpenManualLead={() => setIsManualLeadOpen(true)} />

      {/* Toast Alert */}
      {distributeToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-teal-500 text-slate-950 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <Zap className="w-4 h-4" />
          <span>{distributeToast}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header with Quick Admin Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Super Admin Performance Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">Hommed lead pipeline overview, caller split & RTO conversion control.</p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center space-x-3">
            <button
              onClick={handleDistributeEvenly}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition shadow"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Distribute Unassigned ({unassignedCount})</span>
            </button>
            <button
              onClick={() => setIsManualLeadOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <PlusCircle className="w-4 h-4 text-teal-400" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>

        {/* METRICS CARDS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Leads Ingested</span>
              <Users className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2 tracking-tight">{totalLeads}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">{unassignedCount} unassigned in queue</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Conversion Rate</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2 tracking-tight">{conversionRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">{convertedCount} paying orders</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Overdue Follow-ups</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-2 tracking-tight">{overdueCount}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">Needs immediate caller revert</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">RTO Rate (Returned)</span>
              <PackageX className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-extrabold text-rose-400 mt-2 tracking-tight">{rtoRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">{rtoCount} orders returned</div>
          </div>

        </div>

        {/* CALLER TEAM PERFORMANCE MATRIX */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-teal-400" />
              <span>Calling Team Performance Split</span>
            </h2>
            <Link href="/admin/team" className="text-xs text-teal-400 hover:underline font-semibold flex items-center space-x-1">
              <span>Manage Callers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Caller Name</th>
                    <th className="py-3.5 px-4 text-center">Assigned Leads</th>
                    <th className="py-3.5 px-4 text-center">Qualified</th>
                    <th className="py-3.5 px-4 text-center">Phone Not Picked</th>
                    <th className="py-3.5 px-4 text-center">Converted</th>
                    <th className="py-3.5 px-4 text-center">Useless</th>
                    <th className="py-3.5 px-4 text-center">Overdue</th>
                    <th className="py-3.5 px-4 text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {callerPerformance.map((caller) => (
                    <tr key={caller.callerId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="text-sm">{caller.callerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{caller.email}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-200 text-sm">
                        {caller.assignedTotal}
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-blue-400">
                        {caller.qualifiedCount}
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-amber-400">
                        {caller.phoneNotPickedCount}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-emerald-400 text-sm">
                        {caller.convertedCount}
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-rose-400">
                        {caller.uselessCount}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-semibold ${caller.overdueCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                          {caller.overdueCount}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400 text-sm">
                        {caller.conversionRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PIPELINE BREAKDOWN INDICATORS */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Lead Status Distribution</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Qualified</span>
                  <span className="text-blue-400 font-bold">{qualifiedCount} ({totalLeads > 0 ? Math.round((qualifiedCount / totalLeads) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalLeads > 0 ? (qualifiedCount / totalLeads) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Phone Not Picked</span>
                  <span className="text-amber-400 font-bold">{phoneNotPickedCount} ({totalLeads > 0 ? Math.round((phoneNotPickedCount / totalLeads) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${totalLeads > 0 ? (phoneNotPickedCount / totalLeads) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Converted Orders</span>
                  <span className="text-emerald-400 font-bold">{convertedCount} ({totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalLeads > 0 ? (convertedCount / totalLeads) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Useless / Spam</span>
                  <span className="text-rose-400 font-bold">{uselessCount} ({totalLeads > 0 ? Math.round((uselessCount / totalLeads) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${totalLeads > 0 ? (uselessCount / totalLeads) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Messaging & Webhook System</h3>
              <p className="text-xs text-slate-400">Meta Facebook Lead Ads Webhook & WhatsApp Business Templates Store.</p>
              
              <div className="mt-4 space-y-2">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
                    <span className="font-semibold text-slate-200">Meta Facebook Lead Ads Webhook</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-medium">Active</span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-400"></div>
                    <span className="font-semibold text-slate-200">WhatsApp Business Templates</span>
                  </div>
                  <span className="text-teal-400 font-mono font-semibold">8 Active Templates</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link
                href="/admin/settings"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition"
              >
                <span>Manage WhatsApp Templates & Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

        </div>

      </main>

      {/* Manual Lead Modal */}
      <ManualLeadModal
        isOpen={isManualLeadOpen}
        onClose={() => setIsManualLeadOpen(false)}
        onLeadAdded={handleLeadAdded}
      />
    </div>
  );
}
