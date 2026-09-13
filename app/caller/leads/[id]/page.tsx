'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import WhatsAppModal from '@/components/WhatsAppModal';
import { 
  ArrowLeft, 
  Phone, 
  PhoneMissed, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Send, 
  Package, 
  PackageX, 
  User, 
  Tag, 
  AlertCircle,
  FileText,
  Flame,
  Plus
} from 'lucide-react';
import { Lead, LeadNote, LeadStatus, OrderStatus, UselessReason, Profile, CallReminder } from '@/lib/types';
import { INITIAL_LEADS, INITIAL_NOTES, INITIAL_PROFILES } from '@/lib/mockDb';
import { calculateFollowUpSchedule } from '@/lib/followup';
import PatientCareChecklist from '@/components/PatientCareChecklist';
import QuickWhatsAppButtons from '@/components/QuickWhatsAppButtons';
import RemindMeLaterModal from '@/components/RemindMeLaterModal';
import ReminderNotificationBanner from '@/components/ReminderNotificationBanner';


export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[1]);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [uselessModalOpen, setUselessModalOpen] = useState(false);
  const [selectedUselessReason, setSelectedUselessReason] = useState<UselessReason>('not_interested');
  const [uselessNoteInput, setUselessNoteInput] = useState('');
  const [rtoReasonInput, setRtoReasonInput] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [remindModalOpen, setRemindModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hommed_user_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCurrentUser(parsed);
        } catch (e) {}
      }
    }

    const loadLeadAndNotes = async () => {
      try {
        const leadRes = await fetch('/api/leads', { cache: 'no-store' });
        if (leadRes.ok) {
          const data = await leadRes.json();
          const foundLead = (data.leads || []).find((l: Lead) => l.id === leadId) || INITIAL_LEADS.find((l) => l.id === leadId) || INITIAL_LEADS[0];
          if (foundLead) setLead(foundLead);
        }
        
        const notesRes = await fetch(`/api/notes?leadId=${encodeURIComponent(leadId)}`, { cache: 'no-store' });
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          if (notesData.notes && notesData.notes.length > 0) {
            setNotes(notesData.notes);
            return;
          }
        }
      } catch (err) {
        console.error('Error loading lead/notes in detail page:', err);
      }

      const foundLead = INITIAL_LEADS.find((l) => l.id === leadId) || INITIAL_LEADS[0];
      setLead(foundLead);
      const leadNotes = INITIAL_NOTES.filter((n) => n.lead_id === foundLead?.id);
      setNotes(leadNotes);
    };

    loadLeadAndNotes();
  }, [leadId]);

  if (!lead) return null;

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Status Change Handler
  const handleStatusChange = (newStatus: LeadStatus) => {
    if (newStatus === 'useless') {
      setUselessModalOpen(true);
      return;
    }

    const schedule = calculateFollowUpSchedule(newStatus, lead.follow_up_stage, lead.phone_attempt_count);

    const updated: Lead = {
      ...lead,
      status: newStatus,
      next_follow_up_date: schedule.next_follow_up_date,
      follow_up_stage: schedule.follow_up_stage,
      is_cold: schedule.is_cold,
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLead(updated);

    // Add automated audit note
    const autoNote: LeadNote = {
      id: `note-auto-${Date.now()}`,
      lead_id: lead.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      note: `Status updated to ${newStatus.replace(/_/g, ' ').toUpperCase()}.${schedule.next_follow_up_date ? ` Next follow-up auto-scheduled for ${schedule.next_follow_up_date}.` : ''}`,
      created_at: new Date().toISOString(),
    };

    setNotes([autoNote, ...notes]);
    showToast(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
  };

  // Quick Action: "Phone Not Picked" Counter button
  const handlePhoneNotPicked = () => {
    const attempts = lead.phone_attempt_count + 1;
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const updated: Lead = {
      ...lead,
      status: 'phone_not_picked',
      phone_attempt_count: attempts,
      next_follow_up_date: tomorrowStr,
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLead(updated);

    const autoNote: LeadNote = {
      id: `note-pnp-${Date.now()}`,
      lead_id: lead.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      note: `Attempt #${attempts}: Phone Not Picked. Auto-scheduled follow-up call for tomorrow (${tomorrowStr}).`,
      created_at: new Date().toISOString(),
    };

    setNotes([autoNote, ...notes]);
    showToast(`Attempt #${attempts} logged. Follow-up set to tomorrow!`);
  };

  // Useless Lead Confirm
  const confirmUselessLead = () => {
    const updated: Lead = {
      ...lead,
      status: 'useless',
      useless_reason: selectedUselessReason,
      useless_note: uselessNoteInput,
      next_follow_up_date: null,
      updated_at: new Date().toISOString(),
    };

    setLead(updated);

    const autoNote: LeadNote = {
      id: `note-useless-${Date.now()}`,
      lead_id: lead.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      note: `Marked as Useless Lead. Reason: ${selectedUselessReason.replace(/_/g, ' ')}. Note: ${uselessNoteInput || 'N/A'}`,
      created_at: new Date().toISOString(),
    };

    setNotes([autoNote, ...notes]);
    setUselessModalOpen(false);
    showToast('Lead marked as Useless.');
  };

  // Order Status Change (RTO)
  const handleOrderStatusChange = (newOrderStatus: OrderStatus) => {
    const updated: Lead = {
      ...lead,
      order_status: newOrderStatus,
      rto_reason: newOrderStatus === 'rto' ? rtoReasonInput || lead.rto_reason : null,
      rto_flagged_at: newOrderStatus === 'rto' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    setLead(updated);

    const autoNote: LeadNote = {
      id: `note-order-${Date.now()}`,
      lead_id: lead.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      note: `Order status changed to ${newOrderStatus.toUpperCase()}${newOrderStatus === 'rto' ? `. RTO Reason: ${rtoReasonInput || 'Address mismatch'}` : ''}`,
      created_at: new Date().toISOString(),
    };

    setNotes([autoNote, ...notes]);
    showToast(`Order status updated to ${newOrderStatus.toUpperCase()}`);
  };

  // Submit Caller Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNote.trim();
    if (!trimmed || !lead?.id) return;

    const tempId = `note-user-${Date.now()}`;
    const noteObj: LeadNote = {
      id: tempId,
      lead_id: lead.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      note: trimmed,
      created_at: new Date().toISOString(),
    };

    setNotes([noteObj, ...notes]);
    setNewNote('');
    showToast('Call note added to lead timeline.');

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          note: trimmed,
          authorId: currentUser.id,
          authorName: currentUser.name,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.note) {
          setNotes((prev) => prev.map((n) => (n.id === tempId ? data.note : n)));
        }
      }
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole={currentUser.role} userName={currentUser.name} />

      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-teal-500 text-slate-950 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href={currentUser.role === 'admin' ? '/admin/leads' : '/caller'}
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Leads Queue</span>
          </Link>
        </div>

        {/* Lead Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">{lead.name}</h1>
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${
                  lead.status === 'qualified' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                  lead.status === 'phone_not_picked' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  lead.status === 'converted' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  lead.status === 'useless' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {lead.status.replace(/_/g, ' ')}
                </span>
                {lead.order_status === 'rto' && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-extrabold uppercase rounded shadow animate-pulse">
                    RTO FLAGGED
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400 font-mono">
                <div className="flex items-center space-x-1 text-slate-200">
                  <Phone className="w-3.5 h-3.5 text-teal-400" />
                  <a href={`tel:${lead.phone}`} className="hover:underline font-semibold">{lead.phone}</a>
                </div>
                <div>Source: <span className="text-slate-200">{lead.source}</span></div>
                <div>Campaign: <span className="text-slate-200">{lead.campaign || 'Default'}</span></div>
              </div>
            </div>

            {/* Quick Contact Bar */}
            <div className="flex items-center space-x-3 shrink-0">
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition shadow"
              >
                <Phone className="w-4 h-4" />
                <span>Call Patient</span>
              </a>

              <button
                onClick={() => setIsWhatsAppOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => setRemindModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-xl transition"
              >
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Remind Me Later</span>
              </button>
            </div>

          </div>
        </div>

        {/* PRIMARY CALLER ACTION BAR (4 FIXED STATUSES) */}
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Update Lead Status & Follow-up Trigger
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* 1. Qualified */}
            <button
              onClick={() => handleStatusChange('qualified')}
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                lead.status === 'qualified'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold shadow-lg ring-1 ring-blue-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-blue-500/50 hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold">1. Qualified</span>
              <span className="text-[10px] text-slate-400">7-Day Cadence</span>
            </button>

            {/* 2. Phone Not Picked (With attempt counter button) */}
            <button
              onClick={handlePhoneNotPicked}
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                lead.status === 'phone_not_picked'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-lg ring-1 ring-amber-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500/50 hover:bg-slate-800'
              }`}
            >
              <PhoneMissed className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold">2. Phone Not Picked</span>
              <span className="text-[10px] text-amber-300/80 font-bold">+1 Attempt ({lead.phone_attempt_count}) → Next Day</span>
            </button>

            {/* 3. Useless Lead */}
            <button
              onClick={() => handleStatusChange('useless')}
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                lead.status === 'useless'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold shadow-lg ring-1 ring-rose-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-rose-500/50 hover:bg-slate-800'
              }`}
            >
              <XCircle className="w-5 h-5 text-rose-400" />
              <span className="text-xs font-semibold">3. Useless Lead</span>
              <span className="text-[10px] text-slate-400">Spam / Out of Scope</span>
            </button>

            {/* 4. Converted */}
            <button
              onClick={() => handleStatusChange('converted')}
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                lead.status === 'converted'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-lg ring-1 ring-emerald-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800'
              }`}
            >
              <Package className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-semibold">4. Converted</span>
              <span className="text-[10px] text-slate-400">Paying Patient / Order</span>
            </button>

          </div>
        </div>

        {/* QUICK WHATSAPP ACTIONS (AISENSY) */}
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <QuickWhatsAppButtons
            lead={lead}
            currentUser={currentUser}
            onSuccess={(msg) => showToast(msg)}
            onError={(err) => showToast(err)}
          />
        </div>

        {/* ORDER & RTO SECTION (IF STATUS = CONVERTED) */}
        {lead.status === 'converted' && (
          <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                <Package className="w-4 h-4" />
                <span>Order Status & RTO Delivery Tracking</span>
              </div>
              {lead.order_status === 'rto' && (
                <span className="text-xs text-rose-400 font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>RTO Flagged</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['processing', 'shipped', 'delivered', 'rto'] as const).map((ostatus) => (
                <button
                  key={ostatus}
                  onClick={() => handleOrderStatusChange(ostatus)}
                  className={`p-3 rounded-xl border text-xs font-semibold uppercase tracking-wider transition ${
                    lead.order_status === ostatus
                      ? ostatus === 'rto'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                        : 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {ostatus === 'rto' ? '⚠️ RTO (Returned)' : ostatus}
                </button>
              ))}
            </div>

            {lead.order_status === 'rto' && (
              <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-3">
                <label className="block text-xs font-medium text-rose-300">RTO Failure Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Patient refused at door / wrong pincode / address incomplete..."
                  value={rtoReasonInput || lead.rto_reason || ''}
                  onChange={(e) => setRtoReasonInput(e.target.value)}
                  onBlur={() => handleOrderStatusChange('rto')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            )}
          </div>
        )}

        {/* POST-CONVERSION PATIENT CARE CHECKLIST (TASK 4) */}
        {lead.status === 'converted' && (
          <div className="mt-6">
            <PatientCareChecklist lead={lead} onUpdate={() => setLead({ ...lead })} />
          </div>
        )}


        {/* TWO-COLUMN GRID: LEAD DETAILS & NOTES TRAIL */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Form Answers & Follow-up info */}
          <div className="space-y-6">
            
            {/* Follow-up Schedule Info Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>Follow-up Engine Status</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Next Follow-up Date:</span>
                  <span className="font-mono font-semibold text-teal-300">
                    {lead.next_follow_up_date || 'No active reminder'}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">7-Day Cadence Stage:</span>
                  <span className="font-mono text-slate-200">
                    {lead.follow_up_stage === 0 ? 'New Lead' : `Stage ${lead.follow_up_stage}`}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Call Attempt Count:</span>
                  <span className="font-mono text-amber-300 font-semibold">{lead.phone_attempt_count} attempts</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Cold Lead Status:</span>
                  <span className={lead.is_cold ? 'text-rose-400 font-bold' : 'text-emerald-400 font-medium'}>
                    {lead.is_cold ? 'Cold Bucket' : 'Active Lifecycle'}
                  </span>
                </div>
              </div>
            </div>

            {/* Form Answers Payload */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>Lead Form Responses</span>
              </h3>

              {lead.form_answers && Object.keys(lead.form_answers).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(lead.form_answers).map(([key, val]) => (
                    <div key={key} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{key}</div>
                      <div className="text-xs text-slate-200 font-semibold mt-0.5">{String(val)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No additional form data submitted.</p>
              )}
            </div>

          </div>

          {/* Right Column: Notes Thread & Add Note */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
                <span>Call & Interaction Notes Trail ({notes.length})</span>
                <span className="text-xs text-slate-400 font-normal">Timestamped audit log</span>
              </h3>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="mb-6">
                <div className="relative">
                  <textarea
                    rows={3}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Type call outcome, promises, patient requirements or objections..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!newNote.trim()}
                    className="absolute right-3 bottom-3 inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Add Note</span>
                  </button>
                </div>
              </form>

              {/* Notes Timeline */}
              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-teal-400">{n.author_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed pt-1">{n.note}</p>
                  </div>
                ))}
              </div>

            </div>

          </div>

        </div>

      </main>

      {/* Useless Lead Sub-Reason Modal */}
      {uselessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Mark Lead as Useless</h3>
            <p className="text-xs text-slate-400 mb-4">Please select a reason for reporting metrics:</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reason</label>
                <select
                  value={selectedUselessReason}
                  onChange={(e) => setSelectedUselessReason(e.target.value as UselessReason)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="spam">Spam / Fake Entry</option>
                  <option value="wrong_number">Wrong / Invalid Phone Number</option>
                  <option value="not_interested">Not Interested / Cancelled Request</option>
                  <option value="out_of_scope">Out of Serviceable Location</option>
                  <option value="price_issue">High Price / Budget Issue</option>
                  <option value="other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Additional Note</label>
                <input
                  type="text"
                  value={uselessNoteInput}
                  onChange={(e) => setUselessNoteInput(e.target.value)}
                  placeholder="Optional context..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  onClick={() => setUselessModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUselessLead}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold rounded-lg transition"
                >
                  Confirm Useless
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        lead={lead}
      />

      {/* Remind Me Later Modal */}
      {lead && (
        <RemindMeLaterModal
          isOpen={remindModalOpen}
          onClose={() => setRemindModalOpen(false)}
          lead={lead}
          currentUser={currentUser}
          onReminderSet={(reminder) => {
            const dateStr = new Date(reminder.remind_at).toISOString().split('T')[0];
            const timeStr = new Date(reminder.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setLead((prev) => prev ? { ...prev, next_follow_up_date: dateStr, next_follow_up_time: timeStr } : null);
            showToast(`Reminder scheduled for ${timeStr} (${dateStr})`);
          }}
        />
      )}

      {/* Reminder Notification Banner */}
      <ReminderNotificationBanner currentUser={currentUser} />
    </div>
  );
}
