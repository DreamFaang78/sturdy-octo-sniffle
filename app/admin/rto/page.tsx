'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import WhatsAppModal from '@/components/WhatsAppModal';
import { 
  PackageX, 
  RefreshCw, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  MapPin,
  ChevronRight,
  Send
} from 'lucide-react';
import { Lead, Profile } from '@/lib/types';
import { INITIAL_LEADS, INITIAL_PROFILES } from '@/lib/mockDb';

export default function RtoTrackingPage() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[0]);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
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
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to load leads for RTO:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Converted leads with RTO flag or order_status = 'rto'
  const rtoLeads = leads.filter((l) => l.order_status === 'rto' || l.status === 'converted');

  const handleResolveRto = async (leadId: string, newOrderStatus: 'shipped' | 'delivered') => {
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          order_status: newOrderStatus,
          rto_reason: null,
          updated_at: new Date().toISOString()
        })
      });

      if (!res.ok) throw new Error('Failed to update RTO status');

      const updated = leads.map((l) => {
        if (l.id === leadId) {
          return {
            ...l,
            order_status: newOrderStatus,
            rto_reason: null,
            updated_at: new Date().toISOString(),
          };
        }
        return l;
      });

      setLeads(updated);
      showToast(`RTO resolved! Order re-marked as ${newOrderStatus.toUpperCase()}`);
    } catch (err) {
      console.error('Error resolving RTO:', err);
      showToast('Error updating order status');
    }
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
            <div className="flex items-center space-x-2">
              <PackageX className="w-6 h-6 text-rose-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">RTO (Return to Origin) Recovery Dashboard</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Track undelivered courier sample kits, address mismatches, and re-trigger patient address confirmations via WhatsApp.
            </p>
          </div>
        </div>

        {/* RTO Summary Alert Box */}
        <div className="mt-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-rose-300 font-bold text-base flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>RTO Action Queue ({rtoLeads.filter((l) => l.order_status === 'rto').length} Flagged Orders)</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Converted leads can still fail at delivery. Use this panel to re-verify addresses via AiSensy WhatsApp before re-shipping.
            </p>
          </div>
        </div>

        {/* RTO LEADS CARDS / TABLE */}
        <div className="mt-8 space-y-4">
          {rtoLeads.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
              <div className="text-base font-semibold text-white">No active RTO cases!</div>
              <p className="text-xs text-slate-500 mt-1">All converted orders are shipped or successfully delivered.</p>
            </div>
          ) : (
            rtoLeads.map((lead) => (
              <div key={lead.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                
                {/* Left: Patient & Address Info */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-bold text-white">{lead.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      lead.order_status === 'rto' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      Order Status: {lead.order_status?.toUpperCase() || 'DELIVERED'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                    <div className="flex items-center space-x-1 text-slate-200">
                      <Phone className="w-3.5 h-3.5 text-teal-400" />
                      <span>{lead.phone}</span>
                    </div>
                    <div>Campaign: <span className="text-slate-200">{lead.campaign || 'Diagnostics'}</span></div>
                    <div>Assigned Caller: <span className="text-slate-200">{lead.assignee?.name || 'Calling Team'}</span></div>
                  </div>

                  {lead.rto_reason && (
                    <div className="mt-3 p-3 bg-slate-950 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Failure Reason: </span>
                        <span>{lead.rto_reason}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => setWhatsappLead(lead)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Address Re-confirm</span>
                  </button>

                  <button
                    onClick={() => handleResolveRto(lead.id, 'shipped')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition shadow"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Re-Ship Order</span>
                  </button>

                  <button
                    onClick={() => handleResolveRto(lead.id, 'delivered')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Mark Delivered</span>
                  </button>
                </div>

              </div>
            ))
          )}
        </div>

      </main>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={!!whatsappLead}
        onClose={() => setWhatsappLead(null)}
        lead={whatsappLead}
      />
    </div>
  );
}
