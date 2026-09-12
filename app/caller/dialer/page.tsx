'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  Phone, 
  PhoneMissed, 
  CheckCircle2, 
  XCircle, 
  Package, 
  Mic, 
  MicOff, 
  RotateCcw, 
  SkipForward, 
  ChevronDown, 
  ChevronUp, 
  ArrowLeft, 
  Clock, 
  Flame, 
  Sparkles,
  FileText,
  AlertCircle,
  Bell,
  BellRing,
  LogOut,
  Calendar
} from 'lucide-react';
import { Lead, LeadNote, LeadStatus, Profile, UselessReason } from '@/lib/types';
import { INITIAL_PROFILES } from '@/lib/mockDb';
import { calculateFollowUpSchedule } from '@/lib/followup';
import { 
  requestNotificationPermission, 
  sendBrowserNotification, 
  playNotificationChime, 
  getFollowUpUrgency 
} from '@/lib/notifications';
import { createClient } from '@/lib/supabase/client';
import QuickWhatsAppButtons from '@/components/QuickWhatsAppButtons';

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

export default function HighSpeedCallerDialer() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[1]); // Caller Team
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotesAccordion, setShowNotesAccordion] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [uselessModalOpen, setUselessModalOpen] = useState(false);
  const [uselessReason, setUselessReason] = useState<UselessReason>('not_interested');
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [endOfShiftModalOpen, setEndOfShiftModalOpen] = useState(false);

  // Undo State
  const [undoState, setUndoState] = useState<{
    previousLead: Lead;
    previousIndex: number;
    toastMessage: string;
  } | null>(null);

  const [completedCallsToday, setCompletedCallsToday] = useState(18);
  const dailyTarget = 50;

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

      // Check notification permission
      if ('Notification' in window && Notification.permission === 'granted') {
        setNotificationsAllowed(true);
      }
    }
  }, []);

  // Fetch real leads from API and subscribe to updates
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
      .channel('caller-dialer-leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsAllowed(granted);
    if (granted) {
      playNotificationChime();
      sendBrowserNotification('Hommed CRM Notifications Enabled!', 'You will receive real-time pop-up alerts for urgent follow-up calls.');
    }
  };

  // Filter leads assigned to current caller
  const myQueue = leads.filter((l) => l.assigned_to === currentUser.id);
  const currentLead = myQueue[currentIndex] || myQueue[0] || leads[0];
  const leadNotes = currentLead ? notes.filter((n) => n.lead_id === currentLead.id) : [];

  // Follow-up timing urgency badge
  const urgencyInfo = currentLead ? getFollowUpUrgency(currentLead.next_follow_up_date, currentLead.next_follow_up_time || '10:30 AM') : null;

  // Speech Recognition Handler
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice dictation is supported in Chrome/Edge browser on Desktop & Mobile.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setNoteInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // Auto-advance helper
  const advanceToNextLead = (updatedLead: Lead, actionLabel: string) => {
    const previousIndex = currentIndex;
    const previousLead = { ...currentLead };

    // Play chime & pop-up toast
    playNotificationChime();

    setUndoState({
      previousLead,
      previousIndex,
      toastMessage: `Marked ${previousLead.name} as ${actionLabel.toUpperCase()}. Auto-advancing...`,
    });

    setTimeout(() => setUndoState(null), 4500);

    const nextLeads = leads.map((l) => (l.id === updatedLead.id ? updatedLead : l));
    setLeads(nextLeads);

    if (noteInput.trim()) {
      const noteObj: LeadNote = {
        id: `note-speed-${Date.now()}`,
        lead_id: currentLead.id,
        author_id: currentUser.id,
        author_name: currentUser.name,
        note: noteInput.trim(),
        created_at: new Date().toISOString(),
      };
      setNotes([noteObj, ...notes]);
      setNoteInput('');
    }

    setCompletedCallsToday((prev) => prev + 1);

    if (currentIndex < myQueue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleStatusSelect = (status: LeadStatus) => {
    if (status === 'useless') {
      setUselessModalOpen(true);
      return;
    }

    const schedule = calculateFollowUpSchedule(status, currentLead.follow_up_stage, currentLead.phone_attempt_count);

    const updated: Lead = {
      ...currentLead,
      status,
      next_follow_up_date: schedule.next_follow_up_date,
      next_follow_up_time: '10:30 AM',
      follow_up_stage: schedule.follow_up_stage,
      is_cold: schedule.is_cold,
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    advanceToNextLead(updated, status.replace(/_/g, ' '));
  };

  const handlePhoneNotPicked = () => {
    const attempts = currentLead.phone_attempt_count + 1;
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const updated: Lead = {
      ...currentLead,
      status: 'phone_not_picked',
      phone_attempt_count: attempts,
      next_follow_up_date: tomorrowStr,
      next_follow_up_time: '10:30 AM',
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    advanceToNextLead(updated, `PHONE NOT PICKED (Attempt #${attempts})`);
  };

  const handleConfirmUseless = () => {
    const updated: Lead = {
      ...currentLead,
      status: 'useless',
      useless_reason: uselessReason,
      next_follow_up_date: null,
      next_follow_up_time: null,
      updated_at: new Date().toISOString(),
    };

    setUselessModalOpen(false);
    advanceToNextLead(updated, `USELESS (${uselessReason})`);
  };

  const handleSkipLead = () => {
    if (currentIndex < myQueue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleUndo = () => {
    if (!undoState) return;

    const restoredLeads = leads.map((l) =>
      l.id === undoState.previousLead.id ? undoState.previousLead : l
    );

    setLeads(restoredLeads);
    setCurrentIndex(undoState.previousIndex);
    setCompletedCallsToday((prev) => Math.max(0, prev - 1));
    setUndoState(null);
  };

  if (!currentLead) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-slate-950">
      
      {/* TOP HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <Link
              href="/caller"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Exit Focus Mode</span>
            </Link>

            <div className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
              <span>High-Speed Dialing Mode</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Pop-up Notification Permission Button */}
            <button
              onClick={enableNotifications}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                notificationsAllowed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow'
              }`}
            >
              {notificationsAllowed ? <Bell className="w-3.5 h-3.5 text-emerald-400" /> : <BellRing className="w-3.5 h-3.5" />}
              <span>{notificationsAllowed ? 'Pop-ups Enabled' : 'Enable Pop-ups'}</span>
            </button>

            {/* End of Shift Warning Trigger */}
            <button
              onClick={() => setEndOfShiftModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
              title="Shift Summary Check"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Shift Check</span>
            </button>

            <span className="text-xs font-mono text-slate-400">
              Lead <span className="text-white font-bold">{currentIndex + 1}</span> of {myQueue.length}
            </span>

            <button
              onClick={handleSkipLead}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition border border-slate-700/50"
            >
              <span>Skip</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* FLOATING UNDO TOAST NOTIFICATION */}
      {undoState && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-teal-500/40 text-slate-100 px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-4 animate-in slide-in-from-top duration-200">
          <div className="text-xs">
            <span className="font-semibold text-teal-400">Auto-Advanced: </span>
            <span className="text-slate-200">{undoState.toastMessage}</span>
          </div>
          <button
            onClick={handleUndo}
            className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg text-xs font-bold transition shadow"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>UNDO</span>
          </button>
        </div>
      )}

      {/* MAIN SINGLE LEAD CONTAINER */}
      <main className="max-w-3xl w-full mx-auto px-4 py-6 flex-1 flex flex-col justify-center space-y-6">
        
        {/* GIANT TAP-TO-CALL PATIENT CARD WITH PRECISE TIMING BADGE */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
          
          {/* Attempt Badge */}
          <div className="absolute top-4 right-4 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full text-[11px] font-mono font-medium text-amber-400">
            Attempts: {currentLead.phone_attempt_count}
          </div>

          {/* Precise Follow-up Urgency Tag */}
          {urgencyInfo && (
            <div className="mb-3">
              <span className={`inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-mono uppercase tracking-wide ${urgencyInfo.badgeColor}`}>
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{urgencyInfo.label}</span>
              </span>
            </div>
          )}

          {/* Patient Name */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {currentLead.name}
          </h1>

          <div className="text-xs text-slate-400 mt-1 font-mono">
            {currentLead.campaign || 'Hommed Facebook Lead Ads'}
          </div>

          {/* GIANT TAP-TO-CALL BUTTON */}
          <div className="mt-6">
            <a
              href={`tel:${currentLead.phone}`}
              className="inline-flex items-center justify-center space-x-3 w-full sm:w-auto px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xl rounded-2xl transition shadow-2xl hover:scale-[1.02] active:scale-95"
            >
              <Phone className="w-6 h-6 fill-slate-950" />
              <span>Tap to Call {currentLead.phone}</span>
            </a>
          </div>

          {/* Form Answers Pill - Filtered for Caller Focus */}
          {(() => {
            const answers = currentLead.form_answers || {};

            // 1. City
            const cityKey = Object.keys(answers).find((k) => k.toLowerCase() === 'city' || k.toLowerCase().includes('city'));
            const cityVal = cityKey ? answers[cityKey] : (currentLead as any).city;

            // 2. Age (आयु_(age))
            const ageKey = Object.keys(answers).find((k) => k.includes('आयु') || k.toLowerCase().includes('age'));
            const ageVal = ageKey ? answers[ageKey] : null;

            // 3. Symptom duration (आप_इस_समस्या_से_कब_से_परेशान_हैं?_*)
            const symptomKey = Object.keys(answers).find((k) => k.includes('समस्या') || k.includes('परेशान') || k.toLowerCase().includes('duration'));
            const symptomVal = symptomKey ? answers[symptomKey] : null;

            const displayRows: { label: string; value: string }[] = [];
            if (cityVal) displayRows.push({ label: cityKey || 'city', value: String(cityVal) });
            if (ageVal && ageKey) displayRows.push({ label: ageKey, value: String(ageVal) });
            if (symptomVal && symptomKey) displayRows.push({ label: symptomKey, value: String(symptomVal) });

            if (displayRows.length === 0) return null;

            return (
              <div className="mt-5 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs text-slate-300 space-y-1.5 max-w-md mx-auto shadow-inner">
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                  Inquiry Data
                </div>
                {displayRows.map((row, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4">
                    <span className="text-slate-400 font-mono text-xs shrink-0">{row.label}:</span>
                    <span className="font-semibold text-white text-right text-xs break-words">{row.value}</span>
                  </div>
                ))}
              </div>
            );
          })()}

        </div>

        {/* 4 FIXED COLOR-CODED STATUS ACTION BUTTONS */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          
          {/* 1. Qualified (Blue) */}
          <button
            onClick={() => handleStatusSelect('qualified')}
            className="p-4 bg-blue-600/20 hover:bg-blue-600/30 border-2 border-blue-500/50 hover:border-blue-400 text-blue-300 rounded-2xl flex flex-col items-center justify-center space-y-1 transition shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <CheckCircle2 className="w-7 h-7 text-blue-400" />
            <span className="text-sm font-extrabold uppercase tracking-wide">1. Qualified</span>
            <span className="text-[10px] text-blue-300/80 font-medium">7-Day Follow-Up</span>
          </button>

          {/* 2. Phone Not Picked (Amber) */}
          <button
            onClick={handlePhoneNotPicked}
            className="p-4 bg-amber-600/20 hover:bg-amber-600/30 border-2 border-amber-500/50 hover:border-amber-400 text-amber-300 rounded-2xl flex flex-col items-center justify-center space-y-1 transition shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <PhoneMissed className="w-7 h-7 text-amber-400" />
            <span className="text-sm font-extrabold uppercase tracking-wide">2. Not Picked</span>
            <span className="text-[10px] text-amber-300/80 font-bold">+1 Attempt → Remind Tomorrow</span>
          </button>

          {/* 3. Useless Lead (Red) */}
          <button
            onClick={() => handleStatusSelect('useless')}
            className="p-4 bg-rose-600/20 hover:bg-rose-600/30 border-2 border-rose-500/50 hover:border-rose-400 text-rose-300 rounded-2xl flex flex-col items-center justify-center space-y-1 transition shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <XCircle className="w-7 h-7 text-rose-400" />
            <span className="text-sm font-extrabold uppercase tracking-wide">3. Useless</span>
            <span className="text-[10px] text-rose-300/80 font-medium">Spam / Wrong #</span>
          </button>

          {/* 4. CONVERTED (Green) */}
          <button
            onClick={() => handleStatusSelect('converted')}
            className="col-span-2 md:col-span-3 p-5 bg-emerald-500 hover:bg-emerald-400 border-2 border-emerald-400 text-slate-950 rounded-2xl flex items-center justify-center space-x-3 transition shadow-2xl hover:scale-[1.02] active:scale-95"
          >
            <Package className="w-8 h-8 fill-slate-950 shrink-0" />
            <div className="text-left">
              <div className="text-lg font-black uppercase tracking-wider leading-none">4. CONVERTED (Paying Order)</div>
              <div className="text-xs font-bold opacity-90 mt-0.5">Success Outcome — Primary Goal</div>
            </div>
          </button>

        </div>

        {/* QUICK WHATSAPP ACTIONS (AISENSY) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <QuickWhatsAppButtons
            lead={currentLead}
            currentUser={currentUser}
            onSuccess={(msg) => {
              playNotificationChime();
            }}
          />
        </div>

        {/* VOICE-TO-TEXT & QUICK NOTE INPUT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-teal-400" />
              <span>Quick Call Note (Optional)</span>
            </label>

            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-300 hover:text-teal-400 hover:bg-slate-700'
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-teal-400" />}
              <span>{isListening ? 'Listening...' : 'Voice Dictate'}</span>
            </button>
          </div>

          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Type or speak call notes..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* COLLAPSIBLE PREVIOUS NOTES TRAIL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => setShowNotesAccordion(!showNotesAccordion)}
            className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition"
          >
            <span>Previous Call History ({leadNotes.length} notes)</span>
            {showNotesAccordion ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showNotesAccordion && (
            <div className="p-4 pt-0 border-t border-slate-800 space-y-2 max-h-48 overflow-y-auto">
              {leadNotes.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No previous notes recorded for this patient.</p>
              ) : (
                leadNotes.map((n) => (
                  <div key={n.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold text-teal-400">{n.author_name}</span>
                      <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-200">{n.note}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </main>

      {/* BOTTOM PACE BAR & STAT STRIP */}
      <footer className="bg-slate-900 border-t border-slate-800 p-4 sticky bottom-0 z-40">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1 font-mono">
              <span className="text-slate-400">Daily Dialing Goal Pace</span>
              <span className="text-teal-400 font-bold">{completedCallsToday} / {dailyTarget} calls</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((completedCallsToday / dailyTarget) * 100))}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono shrink-0">
            <div>
              <span className="text-slate-400">Converted: </span>
              <span className="text-emerald-400 font-bold">
                {myQueue.filter((l) => l.status === 'converted').length}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Queue Left: </span>
              <span className="text-amber-400 font-bold">{myQueue.length - currentIndex}</span>
            </div>
          </div>

        </div>
      </footer>

      {/* END OF SHIFT POPUP MODAL */}
      {endOfShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">End-of-Shift Follow-up Checklist</h3>
                <p className="text-xs text-slate-400">Summary before telecaller logoff</p>
              </div>
            </div>

            <div className="space-y-3 my-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Calls Completed Today:</span>
                <span className="font-bold text-teal-400">{completedCallsToday}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Overdue Follow-ups Remaining:</span>
                <span className="font-bold text-rose-400">
                  {myQueue.filter((l) => l.next_follow_up_date && l.next_follow_up_date < new Date().toISOString().split('T')[0]).length}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Due Today Remaining:</span>
                <span className="font-bold text-amber-400">
                  {myQueue.filter((l) => l.next_follow_up_date === new Date().toISOString().split('T')[0]).length}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEndOfShiftModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl font-medium"
              >
                Continue Calling
              </button>
              <button
                onClick={() => {
                  setEndOfShiftModalOpen(false);
                  sendBrowserNotification('Shift Completed!', `Great job! You completed ${completedCallsToday} calls today.`);
                }}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition shadow"
              >
                Acknowledge & Finish Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Useless Sub-Reason Modal */}
      {uselessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Specify Useless Lead Reason</h3>
            
            <div className="space-y-4">
              <select
                value={uselessReason}
                onChange={(e) => setUselessReason(e.target.value as UselessReason)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="spam">Spam / Fake Submission</option>
                <option value="wrong_number">Wrong / Invalid Phone Number</option>
                <option value="not_interested">Not Interested / Cancelled</option>
                <option value="out_of_scope">Out of Serviceable Location</option>
                <option value="price_issue">Price / Budget Issue</option>
                <option value="other">Other Reason</option>
              </select>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setUselessModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUseless}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold rounded-xl transition"
                >
                  Confirm & Auto-Advance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
