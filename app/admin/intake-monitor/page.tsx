'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  CopyX, 
  Clock, 
  RefreshCw, 
  Radio, 
  Zap, 
  Filter,
  Flame,
  HelpCircle
} from 'lucide-react';
import { LeadIngestionLog, IngestionStatus, Profile } from '@/lib/types';
import { INITIAL_INGESTION_LOGS, INITIAL_PROFILES } from '@/lib/mockDb';
import { createClient } from '@/lib/supabase/client';

export default function LeadIntakeMonitorPage() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[0]); // Super Admin
  const [logs, setLogs] = useState<LeadIngestionLog[]>(INITIAL_INGESTION_LOGS);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

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

    // Connect to Supabase Realtime if available
    try {
      const supabase = createClient();
      const channel = supabase
        .channel('realtime_lead_ingestion_log')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'lead_ingestion_log' },
          (payload) => {
            const newRecord = payload.new as LeadIngestionLog;
            setLogs((prev) => [newRecord, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime subscription fallback active:', err);
    }
  }, []);

  // Calculate silence window for Warning Banner
  const now = new Date();
  const currentHour = now.getHours();
  const isBusinessHours = currentHour >= 9 && currentHour < 19; // 9 AM to 7 PM

  const newestLogTime = logs.length > 0 ? new Date(logs[0].created_at).getTime() : 0;
  const hoursSinceLastLead = newestLogTime > 0 ? (now.getTime() - newestLogTime) / (1000 * 3600) : 999;
  const showSilenceWarning = isBusinessHours && hoursSinceLastLead >= 2;

  const filteredLogs = logs.filter((log) => {
    if (filterStatus === 'all') return true;
    return log.status === filterStatus;
  });

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLogs([...INITIAL_INGESTION_LOGS]);
      setIsRefreshing(false);
    }, 600);
  };

  // Simulate Incoming Webhook Lead for Live Testing
  const handleSimulateWebhook = () => {
    setIsSimulating(true);

    const mockNames = ['Rahul Mehta', 'Simran Kaur', 'Amitabh Roy', 'Dr. Sunita Rao', 'Devansh Gupta'];
    const mockCampaigns = ['Hommed Diagnostics Campaign - Delhi NCR', 'Senior Care Consultation Campaign', 'Full Body Checkup Ad Set B'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomCampaign = mockCampaigns[Math.floor(Math.random() * mockCampaigns.length)];
    const randomPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

    const testLog: LeadIngestionLog = {
      id: `ingest-sim-${Date.now()}`,
      meta_lead_id: `leadgen_${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: randomName,
      phone: randomPhone,
      campaign: randomCampaign,
      status: 'success',
      created_at: new Date().toISOString(),
    };

    setTimeout(() => {
      setLogs([testLog, ...logs]);
      INITIAL_INGESTION_LOGS.unshift(testLog);
      setIsSimulating(false);
    }, 400);
  };

  const getStatusBadge = (status: IngestionStatus) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Success</span>
          </span>
        );
      case 'duplicate':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/30">
            <CopyX className="w-3.5 h-3.5" />
            <span>Duplicate Skipped</span>
          </span>
        );
      case 'mapping_error':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>Mapping Error</span>
          </span>
        );
      case 'api_error':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-lg border border-purple-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>API Fetch Error</span>
          </span>
        );
      default:
        return <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded">Unknown</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole="admin" userName={currentUser.name} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Lead Intake Monitor</h1>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Live Supabase Realtime Stream</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Real-time monitoring feed of raw Facebook Lead Ads webhook ingestion events. Monitoring mode only.
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center space-x-3">
            <button
              onClick={handleSimulateWebhook}
              disabled={isSimulating}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl transition shadow"
            >
              <Radio className="w-4 h-4 text-slate-950 animate-pulse" />
              <span>{isSimulating ? 'Ingesting...' : 'Test Webhook Ingestion'}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title="Refresh Stream"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* SILENCE WARNING BANNER (> 2 hours during business hours) */}
        {showSilenceWarning && (
          <div className="mt-6 bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl p-5 shadow-2xl flex items-start space-x-4 animate-in slide-in-from-top duration-300">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl shrink-0">
              <AlertTriangle className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-rose-300 tracking-wide">
                ⚠️ WARNING: No Leads Received Recently
              </h3>
              <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                The Facebook Lead Ads webhook has not ingested any new leads for{' '}
                <span className="font-bold underline">{hoursSinceLastLead.toFixed(1)} hours</span> during active business hours (9:00 AM – 7:00 PM).
              </p>
              <div className="mt-3 flex items-center space-x-4 text-[11px] font-mono text-rose-300/80">
                <span>Check: Meta Webhook Subscription</span>
                <span>•</span>
                <span>Facebook Ad Campaign Status</span>
                <span>•</span>
                <span>Meta Access Token Expiry</span>
              </div>
            </div>
          </div>
        )}

        {/* METRICS & SUMMARY STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-xs text-slate-400 font-medium">Total Ingested Events</div>
            <div className="text-2xl font-bold text-white mt-1">{logs.length}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-xs text-slate-400 font-medium">Successful Intake</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {logs.filter((l) => l.status === 'success').length}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-xs text-slate-400 font-medium">Duplicates Skipped</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {logs.filter((l) => l.status === 'duplicate').length}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-xs text-slate-400 font-medium">Errors (Mapping/API)</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {logs.filter((l) => l.status === 'mapping_error' || l.status === 'api_error').length}
            </div>
          </div>
        </div>

        {/* INGESTION MONITOR FEED TABLE */}
        <div className="mt-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Real-Time Ingestion Log Feed</h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'success', 'duplicate', 'mapping_error', 'api_error'] as const).map((statusKey) => (
                <button
                  key={statusKey}
                  onClick={() => setFilterStatus(statusKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                    filterStatus === statusKey
                      ? 'bg-teal-500 text-slate-950 shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {statusKey === 'all' ? `All (${logs.length})` : `${statusKey.replace(/_/g, ' ')} (${logs.filter((l) => l.status === statusKey).length})`}
                </button>
              ))}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 mt-2">
              <Radio className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <div className="text-base font-medium text-slate-200">No ingestion events match this filter</div>
              <p className="text-xs text-slate-500 mt-1">New incoming Facebook leads will automatically stream here.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Ingestion Timestamp</th>
                      <th className="py-3.5 px-4">Lead Name & Phone</th>
                      <th className="py-3.5 px-4">Source Campaign</th>
                      <th className="py-3.5 px-4">Ingestion Status</th>
                      <th className="py-3.5 px-4">Meta Leadgen ID & Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {filteredLogs.map((log) => {
                      const logDate = new Date(log.created_at);
                      const timeStr = logDate.toLocaleTimeString();
                      const dateStr = logDate.toLocaleDateString();

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          
                          <td className="py-3.5 px-4 text-slate-300">
                            <div className="font-bold text-white">{timeStr}</div>
                            <div className="text-[10px] text-slate-500">{dateStr}</div>
                          </td>

                          <td className="py-3.5 px-4 font-sans">
                            <div className="font-semibold text-white">{log.name || 'Unmapped Name'}</div>
                            <div className="text-slate-400 font-mono text-xs">{log.phone || '—'}</div>
                          </td>

                          <td className="py-3.5 px-4 font-sans text-slate-300">
                            <div className="truncate max-w-[200px] font-medium text-slate-200">
                              {log.campaign || 'Direct FB Ad Form'}
                            </div>
                            <div className="text-[10px] text-slate-500">Facebook Lead Ads</div>
                          </td>

                          <td className="py-3.5 px-4 font-sans">
                            {getStatusBadge(log.status)}
                          </td>

                          <td className="py-3.5 px-4 text-slate-400">
                            <div className="text-teal-400 font-semibold">{log.meta_lead_id || 'N/A'}</div>
                            {log.error_detail && (
                              <div className="text-[11px] text-rose-300/90 font-sans mt-0.5 max-w-xs leading-tight">
                                {log.error_detail}
                              </div>
                            )}
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
    </div>
  );
}
