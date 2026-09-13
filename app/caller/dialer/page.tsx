'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Calendar,
  Plus,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  PhoneOff,
  Users,
  MessageSquare,
  X
} from 'lucide-react';
import { Lead, LeadNote, LeadStatus, Profile, UselessReason, CallReminder } from '@/lib/types';
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
import RemindMeLaterModal from '@/components/RemindMeLaterModal';
import ReminderNotificationBanner from '@/components/ReminderNotificationBanner';

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

export default function HighSpeedCallerDialer() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[1]); // Caller Team
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotesAccordion, setShowNotesAccordion] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [uselessModalOpen, setUselessModalOpen] = useState(false);
  const [uselessReason, setUselessReason] = useState<UselessReason>('not_interested');
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [endOfShiftModalOpen, setEndOfShiftModalOpen] = useState(false);
  const [remindModalOpen, setRemindModalOpen] = useState(false);
  const [reminders, setReminders] = useState<CallReminder[]>([]);

  const [otherReasonModalOpen, setOtherReasonModalOpen] = useState(false);
  const [selectedOtherSubOption, setSelectedOtherSubOption] = useState<'incoming_na' | 'friend_picked' | 'other' | null>(null);
  const [otherReasonCustomText, setOtherReasonCustomText] = useState('');
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  // Undo State
  const [undoState, setUndoState] = useState<{
    previousLead: Lead;
    previousIndex: number;
    toastMessage: string;
  } | null>(null);

  const [sessionCompletedCalls, setSessionCompletedCalls] = useState(0);
  const restoredCallerIdRef = useRef<string | null>(null);
  const dailyTarget = 50;

  // Persist caller's current lead position to both localStorage (instant client sync) and Supabase settings (durable server state)
  const persistQueuePosition = (leadId: string, callerId: string = currentUser.id) => {
    if (!leadId || !callerId) return;

    // 1. Instant local storage cache
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`hommed_dialer_pos_${callerId}`, leadId);
      } catch (e) {}
    }

    // 2. Server-side persistence in Supabase
    fetch('/api/caller/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callerId, leadId }),
    }).catch((err) => console.error('[Dialer] Failed to persist position to Supabase:', err));
  };

  // Calculate contacted leads today from DB + current session increment
  const todayDateStr = new Date().toISOString().split('T')[0];
  const dbContactedToday = leads.filter((l) => l.last_contacted_at && l.last_contacted_at.startsWith(todayDateStr)).length;
  const completedCallsToday = dbContactedToday + sessionCompletedCalls;

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

  // Fetch reminders for current caller
  const fetchReminders = async () => {
    try {
      const res = await fetch(`/api/reminders?callerId=${currentUser.id}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchReminders();
  }, [currentUser.id]);

  // Fetch real leads from API and subscribe to updates
  useEffect(() => {
    const supabase = createClient();

    const loadLeads = async () => {
      const data = await fetchLeadsFromApi(currentUser.id);
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
  }, [currentUser.id]);

  // Restore caller's saved queue position on load / refresh (from URL param, Supabase DB, or local cache)
  useEffect(() => {
    if (leads.length === 0) return;
    if (restoredCallerIdRef.current === currentUser.id) return;

    const restoreQueuePosition = async () => {
      const callerAssigned = leads.filter((l) => l.assigned_to === currentUser.id);
      const queueToSearch = callerAssigned.length > 0 ? callerAssigned : leads;

      // 1. Check URL query param leadId first (e.g. direct link from leads table or reminder)
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlLeadId = params?.get('leadId');

      if (urlLeadId) {
        const idx = queueToSearch.findIndex((l) => l.id === urlLeadId);
        if (idx !== -1) {
          setCurrentIndex(idx);
          setNoteInput(draftNotes[queueToSearch[idx].id] || '');
          restoredCallerIdRef.current = currentUser.id;
          window.history.replaceState({}, '', window.location.pathname);
          persistQueuePosition(queueToSearch[idx].id, currentUser.id);
          return;
        }
      }

      // 2. Fetch server-side saved current_lead_id from Supabase
      let serverLeadId: string | null = null;
      try {
        const res = await fetch(`/api/caller/position?callerId=${encodeURIComponent(currentUser.id)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.leadId) {
            serverLeadId = json.leadId;
          }
        }
      } catch (err) {
        console.error('[Dialer] Error fetching position from Supabase:', err);
      }

      // 3. Fallback to localStorage cache
      let cachedLeadId: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          cachedLeadId = localStorage.getItem(`hommed_dialer_pos_${currentUser.id}`);
        } catch (e) {}
      }

      const targetLeadId = serverLeadId || cachedLeadId;

      if (targetLeadId) {
        const idx = queueToSearch.findIndex((l) => l.id === targetLeadId);
        if (idx !== -1) {
          setCurrentIndex(idx);
          setNoteInput(draftNotes[queueToSearch[idx].id] || '');
        } else {
          // Graceful fallback: If saved lead no longer exists or was reassigned, start at first lead in queue
          setCurrentIndex(0);
          if (queueToSearch[0]?.id) {
            persistQueuePosition(queueToSearch[0].id, currentUser.id);
          }
        }
      } else {
        // First-ever visit: start on lead 0 and persist initial position
        setCurrentIndex(0);
        if (queueToSearch[0]?.id) {
          persistQueuePosition(queueToSearch[0].id, currentUser.id);
        }
      }

      restoredCallerIdRef.current = currentUser.id;
    };

    restoreQueuePosition();
  }, [leads, currentUser.id]);

  // Filter leads assigned to current caller (fall back to all returned leads if queue empty)
  const myQueue = leads.filter((l) => l.assigned_to === currentUser.id);
  const activeQueue = myQueue.length > 0 ? myQueue : leads;
  const currentLead = activeQueue[currentIndex] || activeQueue[0] || leads[0];
  const leadNotes = currentLead ? notes.filter((n) => n.lead_id === currentLead.id) : [];

  // Fetch notes specifically for the active lead from live DB
  const fetchNotesForLead = async (leadId: string) => {
    if (!leadId) return;
    try {
      setNotesLoading(true);
      const res = await fetch(`/api/notes?leadId=${encodeURIComponent(leadId)}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const fetchedNotes: LeadNote[] = json.notes || [];
        setNotes((prev) => {
          const otherNotes = prev.filter((n) => n.lead_id !== leadId);
          return [...fetchedNotes, ...otherNotes];
        });
      }
    } catch (err) {
      console.error('[Speed Dial] Error fetching notes for lead:', err);
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    if (currentLead?.id) {
      fetchNotesForLead(currentLead.id);
    }
  }, [currentLead?.id]);

  // Subscribe to real-time changes on lead_notes for current lead
  useEffect(() => {
    if (!currentLead?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`caller-dialer-notes-${currentLead.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_notes',
          filter: `lead_id=eq.${currentLead.id}`,
        },
        () => {
          fetchNotesForLead(currentLead.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentLead?.id]);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsAllowed(granted);
    if (granted) {
      playNotificationChime();
      sendBrowserNotification('Hommed CRM Notifications Enabled!', 'You will receive real-time pop-up alerts for urgent follow-up calls.');
    }
  };

  // Active callback reminder for current lead
  const activeReminder = currentLead ? reminders.find((r) => r.lead_id === currentLead.id && r.status === 'pending') : null;

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
        setNoteInput((prev) => {
          const newVal = prev ? `${prev} ${transcript}` : transcript;
          if (currentLead?.id) {
            setDraftNotes((d) => ({ ...d, [currentLead.id]: newVal }));
          }
          return newVal;
        });
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // Handle note input change with live draft caching
  const handleNoteInputChange = (val: string) => {
    setNoteInput(val);
    if (currentLead?.id) {
      setDraftNotes((prev) => ({ ...prev, [currentLead.id]: val }));
    }
  };

  // Navigation helpers: Previous and Next
  const handlePrevLead = () => {
    if (currentIndex > 0) {
      if (currentLead?.id) {
        setDraftNotes((prev) => ({ ...prev, [currentLead.id]: noteInput }));
      }
      const prevIdx = currentIndex - 1;
      const targetLead = activeQueue[prevIdx];
      setCurrentIndex(prevIdx);
      setNoteInput(draftNotes[targetLead?.id] || '');
      if (targetLead?.id) {
        persistQueuePosition(targetLead.id, currentUser.id);
      }
    }
  };

  const handleNextLead = () => {
    if (currentIndex < activeQueue.length - 1) {
      if (currentLead?.id) {
        setDraftNotes((prev) => ({ ...prev, [currentLead.id]: noteInput }));
      }
      const nextIdx = currentIndex + 1;
      const targetLead = activeQueue[nextIdx];
      setCurrentIndex(nextIdx);
      setNoteInput(draftNotes[targetLead?.id] || '');
      if (targetLead?.id) {
        persistQueuePosition(targetLead.id, currentUser.id);
      }
    }
  };

  // Handle manual saving of Quick Call Note for current lead
  const handleSaveNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = noteInput.trim();
    if (!trimmed || !currentLead?.id || isSavingNote) return;

    setIsSavingNote(true);
    const tempId = `temp-note-${Date.now()}`;
    const optimisticNote: LeadNote = {
      id: tempId,
      lead_id: currentLead.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      note: trimmed,
      created_at: new Date().toISOString(),
    };

    // Optimistically add to state immediately
    setNotes((prev) => [optimisticNote, ...prev]);
    setNoteInput('');
    setDraftNotes((prev) => {
      const copy = { ...prev };
      delete copy[currentLead.id];
      return copy;
    });
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2500);

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: currentLead.id,
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
      } else {
        fetchNotesForLead(currentLead.id);
      }
    } catch (err) {
      console.error('Failed to save note:', err);
      fetchNotesForLead(currentLead.id);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Auto-advance helper (supports optional explicit audit note for Previous Call History)
  const advanceToNextLead = (updatedLead: Lead, actionLabel: string, explicitAuditNote?: string) => {
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

    // 1. Explicit audit note (outcome trail)
    if (explicitAuditNote && currentLead?.id) {
      const tempId = `audit-note-${Date.now()}`;
      const optimisticAuditNote: LeadNote = {
        id: tempId,
        lead_id: currentLead.id,
        author_id: currentUser.id,
        author_name: currentUser.name,
        note: explicitAuditNote,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [optimisticAuditNote, ...prev]);

      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: currentLead.id,
          note: explicitAuditNote,
          authorId: currentUser.id,
          authorName: currentUser.name,
        }),
      }).catch((e) => console.error('Error saving audit note on advance:', e));
    }

    // 2. Manual note entered by caller
    const trimmedInput = noteInput.trim();
    if (trimmedInput && currentLead?.id) {
      const tempId = `manual-note-${Date.now()}`;
      const optimisticNote: LeadNote = {
        id: tempId,
        lead_id: currentLead.id,
        author_id: currentUser.id,
        author_name: currentUser.name,
        note: trimmedInput,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [optimisticNote, ...prev]);

      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: currentLead.id,
          note: trimmedInput,
          authorId: currentUser.id,
          authorName: currentUser.name,
        }),
      }).catch((e) => console.error('Error saving manual note on advance:', e));
    }

    // Clear draft for current lead
    setDraftNotes((prev) => {
      const copy = { ...prev };
      delete copy[currentLead.id];
      return copy;
    });

    // Persist lead status update to backend DB
    fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: updatedLead.id,
        status: updatedLead.status,
        phone_attempt_count: updatedLead.phone_attempt_count,
        last_contacted_at: updatedLead.last_contacted_at,
        next_follow_up_date: updatedLead.next_follow_up_date,
        next_follow_up_time: updatedLead.next_follow_up_time,
        follow_up_stage: updatedLead.follow_up_stage,
        is_cold: updatedLead.is_cold,
        useless_reason: updatedLead.useless_reason,
        useless_note: updatedLead.useless_note,
        order_status: updatedLead.order_status,
      }),
    }).catch((e) => console.error('Error persisting lead update:', e));

    setSessionCompletedCalls((prev) => prev + 1);

    // Advance to next lead and load draft
    let nextIdx = 0;
    if (currentIndex < activeQueue.length - 1) {
      nextIdx = currentIndex + 1;
    }
    const nextLeadObj = activeQueue[nextIdx];
    setCurrentIndex(nextIdx);
    setNoteInput(draftNotes[nextLeadObj?.id] || '');
    if (nextLeadObj?.id) {
      persistQueuePosition(nextLeadObj.id, currentUser.id);
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

    advanceToNextLead(
      updated, 
      status.replace(/_/g, ' '),
      `Call Outcome: Status marked as ${status.replace(/_/g, ' ').toUpperCase()}.${schedule.next_follow_up_date ? ` Follow-up scheduled for ${schedule.next_follow_up_date}.` : ''}`
    );
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

    advanceToNextLead(
      updated, 
      `PHONE NOT PICKED (Attempt #${attempts})`,
      `Call Outcome: Phone Not Picked (Attempt #${attempts}). Auto-rescheduled for tomorrow.`
    );
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
    advanceToNextLead(
      updated, 
      `USELESS (${uselessReason})`,
      `Call Outcome: Marked as USELESS (${uselessReason.replace(/_/g, ' ')}).`
    );
  };

  // Option A: Incoming Not Available
  const handleIncomingNotAvailable = () => {
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
      form_answers: {
        ...(currentLead.form_answers || {}),
        unreachable_type: 'unreachable_incoming_na',
        unreachable_label: 'Incoming Not Available',
      },
    };

    setOtherReasonModalOpen(false);
    setSelectedOtherSubOption(null);
    setOtherReasonCustomText('');

    advanceToNextLead(
      updated, 
      'INCOMING NOT AVAILABLE',
      'Call Outcome: Incoming Not Available / Switch Off. Scheduled follow-up for tomorrow.'
    );
  };

  // Option B: Phone/Friend Picked Up
  const handlePhoneFriendPickedUp = () => {
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
      form_answers: {
        ...(currentLead.form_answers || {}),
        unreachable_type: 'unreachable_third_party',
        unreachable_label: 'Phone/Friend Picked Up',
      },
    };

    setOtherReasonModalOpen(false);
    setSelectedOtherSubOption(null);
    setOtherReasonCustomText('');

    advanceToNextLead(
      updated, 
      'PHONE / FRIEND PICKED UP',
      'Call Outcome: Phone / Friend Picked Up (Patient Unavailable). Scheduled follow-up for tomorrow.'
    );
  };

  // Option C: Other Reason (free-text submit)
  const handleSubmitOtherReason = (e: React.FormEvent) => {
    e.preventDefault();
    const reasonTrimmed = otherReasonCustomText.trim();
    if (!reasonTrimmed) return;

    const attempts = currentLead.phone_attempt_count + 1;
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const updated: Lead = {
      ...currentLead,
      status: 'phone_not_picked',
      phone_attempt_count: attempts,
      useless_reason: 'other',
      useless_note: reasonTrimmed,
      next_follow_up_date: tomorrowStr,
      next_follow_up_time: '10:30 AM',
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      form_answers: {
        ...(currentLead.form_answers || {}),
        unreachable_type: 'unreachable_other',
        unreachable_label: 'Other Reason',
        unreachable_reason: reasonTrimmed,
      },
    };

    setOtherReasonModalOpen(false);
    setSelectedOtherSubOption(null);
    setOtherReasonCustomText('');

    advanceToNextLead(
      updated, 
      `OTHER: ${reasonTrimmed}`,
      `Call Outcome - Other Reason: ${reasonTrimmed}`
    );
  };

  const handleSkipLead = () => {
    if (currentLead?.id) {
      setDraftNotes((prev) => ({ ...prev, [currentLead.id]: noteInput }));
    }
    let nextIdx = 0;
    if (currentIndex < activeQueue.length - 1) {
      nextIdx = currentIndex + 1;
    }
    const targetLead = activeQueue[nextIdx];
    setCurrentIndex(nextIdx);
    setNoteInput(draftNotes[targetLead?.id] || '');
    if (targetLead?.id) {
      persistQueuePosition(targetLead.id, currentUser.id);
    }
  };

  const handleUndo = () => {
    if (!undoState) return;

    const restoredLeads = leads.map((l) =>
      l.id === undoState.previousLead.id ? undoState.previousLead : l
    );

    setLeads(restoredLeads);
    setCurrentIndex(undoState.previousIndex);
    const targetLead = restoredLeads[undoState.previousIndex];
    setNoteInput(draftNotes[targetLead?.id] || '');
    setSessionCompletedCalls((prev) => Math.max(0, prev - 1));
    setUndoState(null);
    if (targetLead?.id) {
      persistQueuePosition(targetLead.id, currentUser.id);
    }
  };

  if (!currentLead) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-slate-950">
      
      {/* TOP HEADER */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2.5 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link
              href="/caller"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Exit Focus</span>
            </Link>

            <div className="text-[11px] sm:text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center space-x-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 animate-pulse shrink-0" />
              <span>Speed Dial</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Pop-up Notification Permission Button */}
            <button
              onClick={enableNotifications}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                notificationsAllowed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow'
              }`}
            >
              {notificationsAllowed ? <Bell className="w-3.5 h-3.5 text-emerald-400" /> : <BellRing className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline">{notificationsAllowed ? 'Pop-ups' : 'Enable Pop-ups'}</span>
            </button>

            {/* End of Shift Warning Trigger */}
            <button
              onClick={() => setEndOfShiftModalOpen(true)}
              className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
              title="Shift Summary Check"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Shift Check</span>
            </button>

            {/* Back / Counter / Forward Navigation Group */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/60 rounded-lg p-0.5 space-x-1">
              <button
                onClick={handlePrevLead}
                disabled={currentIndex === 0}
                className="px-2 py-1 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 hover:text-white rounded text-xs font-semibold flex items-center space-x-1 transition"
                title="Previous Lead (◀)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <span className="px-2 py-0.5 text-xs font-mono text-slate-400 whitespace-nowrap bg-slate-900/80 rounded border border-slate-800">
                <span className="text-white font-bold">{currentIndex + 1}</span>/{activeQueue.length}
              </span>

              <button
                onClick={handleNextLead}
                disabled={currentIndex >= activeQueue.length - 1}
                className="px-2 py-1 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 hover:text-white rounded text-xs font-semibold flex items-center space-x-1 transition"
                title="Next Lead (▶)"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleSkipLead}
              className="inline-flex items-center space-x-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition border border-slate-700/50"
              title="Skip Lead (moves to next, cycles at queue end)"
            >
              <span>Skip</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* FLOATING UNDO TOAST NOTIFICATION */}
      {undoState && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-teal-500/40 text-slate-100 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-top duration-200">
          <div className="text-xs">
            <span className="font-semibold text-teal-400">Auto-Advanced: </span>
            <span className="text-slate-200">{undoState.toastMessage}</span>
          </div>
          <button
            onClick={handleUndo}
            className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg text-xs font-bold transition shadow shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>UNDO</span>
          </button>
        </div>
      )}

      {/* MAIN SINGLE LEAD CONTAINER */}
      <main className="max-w-2xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3.5 flex-1 pb-24 sm:pb-28">
        
        {/* SECTION 1: LEAD IDENTITY & TAP-TO-CALL CARD */}
        <section className="bg-slate-900 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl text-center relative overflow-hidden">
          
          {/* Status & Timing Badges Row */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-2">
            
            {/* Attempt Badge */}
            <span className="bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-amber-400 shrink-0">
              Attempts: {currentLead.phone_attempt_count}
            </span>

            {/* Follow-up Urgency Tag */}
            {urgencyInfo && (
              <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wide shrink-0 ${urgencyInfo.badgeColor}`}>
                <Clock className="w-3 h-3 shrink-0" />
                <span>{urgencyInfo.label}</span>
              </span>
            )}

            {/* Remind Me Later Button */}
            <button
              onClick={() => setRemindModalOpen(true)}
              type="button"
              className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 rounded-full text-[11px] font-bold transition shadow hover:scale-[1.02] active:scale-95 shrink-0"
              title="Schedule Callback for later"
            >
              <Bell className="w-3 h-3 text-indigo-400" />
              <span>Remind Me Later</span>
            </button>

          </div>

          {/* Active Scheduled Callback Alert Banner */}
          {activeReminder && (
            <div className="mb-2.5 inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-500/50 rounded-xl text-xs text-indigo-300 font-bold shadow-sm animate-pulse">
              <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                ⏰ Callback: {new Date(activeReminder.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(activeReminder.remind_at).toLocaleDateString([], { month: 'short', day: 'numeric' })})
              </span>
              {activeReminder.note && (
                <span className="text-slate-300 italic truncate max-w-xs font-normal">
                  — "{activeReminder.note}"
                </span>
              )}
            </div>
          )}

          {/* Patient Name & Subtitle */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {currentLead.name}
          </h1>

          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            {currentLead.campaign || 'Hommed Facebook Lead Ads'}
          </div>

          {/* GIANT TAP-TO-CALL BUTTON */}
          <div className="mt-3.5 w-full">
            <a
              href={`tel:${currentLead.phone}`}
              className="inline-flex items-center justify-center space-x-3 w-full py-3.5 sm:py-4 px-6 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-lg sm:text-xl rounded-xl sm:rounded-2xl transition shadow-xl hover:scale-[1.01] active:scale-95"
            >
              <Phone className="w-5 h-5 sm:w-6 sm:h-6 fill-slate-950 shrink-0" />
              <span className="tracking-tight">Tap to Call {currentLead.phone}</span>
            </a>
          </div>

          {/* Form Answers Pill - Inquiry Data */}
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
              <div className="mt-3 p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-left text-xs text-slate-300 space-y-1 max-w-md mx-auto shadow-inner">
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
                  Inquiry Data
                </div>
                {displayRows.map((row, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-3">
                    <span className="text-slate-400 font-mono text-[11px] shrink-0">{row.label}:</span>
                    <span className="font-semibold text-white text-right text-[11px] break-words">{row.value}</span>
                  </div>
                ))}
              </div>
            );
          })()}

        </section>

        {/* SECTION 2: 4 PRIMARY OUTCOME BUTTONS + 5TH OTHER/UNREACHABLE BUTTON */}
        <section className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Log Call Outcome
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            
            {/* 1. Qualified (Blue) */}
            <button
              onClick={() => handleStatusSelect('qualified')}
              className="p-3 sm:p-3.5 bg-blue-600/15 hover:bg-blue-600/25 border-2 border-blue-500/40 hover:border-blue-400 text-blue-300 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center space-y-0.5 transition shadow-lg hover:scale-[1.01] active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">1. Qualified</span>
              <span className="text-[10px] text-blue-300/80 font-medium">7-Day Follow-Up</span>
            </button>

            {/* 2. Phone Not Picked (Amber) */}
            <button
              onClick={handlePhoneNotPicked}
              className="p-3 sm:p-3.5 bg-amber-600/15 hover:bg-amber-600/25 border-2 border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center space-y-0.5 transition shadow-lg hover:scale-[1.01] active:scale-95"
            >
              <PhoneMissed className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">2. Not Picked</span>
              <span className="text-[10px] text-amber-300/80 font-bold">+1 → Remind Tomorrow</span>
            </button>

            {/* 3. Useless Lead (Red) */}
            <button
              onClick={() => handleStatusSelect('useless')}
              className="p-3 sm:p-3.5 bg-rose-600/15 hover:bg-rose-600/25 border-2 border-rose-500/40 hover:border-rose-400 text-rose-300 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center space-y-0.5 transition shadow-lg hover:scale-[1.01] active:scale-95"
            >
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">3. Useless</span>
              <span className="text-[10px] text-rose-300/80 font-medium">Spam / Wrong #</span>
            </button>

            {/* 4. CONVERTED (Green Primary Target) */}
            <button
              onClick={() => handleStatusSelect('converted')}
              className="p-3 sm:p-3.5 bg-emerald-500 hover:bg-emerald-400 border-2 border-emerald-400 text-slate-950 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center space-y-0.5 transition shadow-xl hover:scale-[1.01] active:scale-95"
            >
              <Package className="w-5 h-5 sm:w-6 sm:h-6 fill-slate-950 shrink-0" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider">4. CONVERTED</span>
              <span className="text-[10px] font-bold opacity-90">Paying Order Goal</span>
            </button>

          </div>

          {/* 5. Other / Unreachable Reason Button */}
          <button
            onClick={() => {
              setSelectedOtherSubOption(null);
              setOtherReasonCustomText('');
              setOtherReasonModalOpen(true);
            }}
            className="w-full p-2.5 sm:p-3 bg-purple-600/15 hover:bg-purple-600/25 border-2 border-purple-500/40 hover:border-purple-400 text-purple-300 rounded-xl sm:rounded-2xl flex items-center justify-center space-x-2 transition shadow-md hover:scale-[1.005] active:scale-95"
          >
            <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">5. Other / Unreachable Reason</span>
            <span className="text-[10px] text-purple-300/70 font-normal hidden xs:inline">→ Switch Off / 3rd Party / Custom</span>
          </button>
        </section>

        {/* SECTION 3: SECONDARY TOOLS & COMMUNICATION (WhatsApp, Call Notes, History) */}
        <section className="space-y-3 pt-1">
          
          {/* QUICK WHATSAPP ACTIONS (AISENSY) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl">
            <QuickWhatsAppButtons
              lead={currentLead}
              currentUser={currentUser}
              onSuccess={(msg) => {
                playNotificationChime();
              }}
            />
          </div>

          {/* VOICE-TO-TEXT & QUICK NOTE INPUT */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>Quick Call Note (Optional)</span>
                {noteSavedFeedback && (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1 ml-2 animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:text-teal-400 hover:bg-slate-700'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-teal-400" />}
                <span>{isListening ? 'Listening...' : 'Voice Dictate'}</span>
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => handleNoteInputChange(e.target.value)}
                placeholder="Type or speak call notes..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={!noteInput.trim() || isSavingNote}
                className="px-3.5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:hover:bg-teal-500 text-slate-950 rounded-xl text-xs font-bold transition shrink-0 flex items-center space-x-1.5 shadow"
              >
                {isSavingNote ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Save Note</span>
              </button>
            </form>
          </div>

          {/* COLLAPSIBLE PREVIOUS NOTES TRAIL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <button
              type="button"
              onClick={() => setShowNotesAccordion(!showNotesAccordion)}
              className="w-full p-3.5 text-left flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center space-x-2">
                <span>Previous Call History ({leadNotes.length} notes)</span>
                {notesLoading && <Loader2 className="w-3 h-3 text-teal-400 animate-spin" />}
              </span>
              {showNotesAccordion ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showNotesAccordion && (
              <div className="p-3.5 pt-0 border-t border-slate-800 space-y-2 max-h-48 overflow-y-auto">
                {leadNotes.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No previous notes recorded for this patient.</p>
                ) : (
                  leadNotes.map((n) => (
                    <div key={n.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span className="font-semibold text-teal-400">{n.author_name}</span>
                        <span className="font-mono">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{n.note}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </section>

      </main>

      {/* BOTTOM PACE BAR & STAT STRIP (PINNED / STICKY AT BOTTOM) */}
      <footer className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 sticky bottom-0 z-40 shadow-2xl">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1 font-mono">
              <span className="text-slate-400">Daily Dialing Goal Pace</span>
              <span className="text-teal-400 font-bold">{completedCallsToday} / {dailyTarget} calls</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
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
                {activeQueue.filter((l) => l.status === 'converted').length}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Queue Left: </span>
              <span className="text-amber-400 font-bold">
                {Math.max(0, activeQueue.length - (currentIndex + 1))}
              </span>
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

      {/* 5. Other / Unreachable Reason Modal */}
      {otherReasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 text-slate-100 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setOtherReasonModalOpen(false);
                setSelectedOtherSubOption(null);
                setOtherReasonCustomText('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Other / Unreachable Reason</h3>
                <p className="text-xs text-slate-400">Select specific unreachable reason</p>
              </div>
            </div>

            <div className="space-y-2.5 my-3">
              {/* Option A: Incoming Not Available */}
              <button
                onClick={handleIncomingNotAvailable}
                className="w-full p-3.5 bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/50 rounded-xl text-left transition flex items-start space-x-3 group"
              >
                <PhoneOff className="w-4 h-4 text-purple-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-100 group-hover:text-purple-300">
                    a. Incoming Not Available
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Phone switched off / network unreachable. Follow-up scheduled for tomorrow.
                  </div>
                </div>
              </button>

              {/* Option B: Phone/Friend Picked Up */}
              <button
                onClick={handlePhoneFriendPickedUp}
                className="w-full p-3.5 bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/50 rounded-xl text-left transition flex items-start space-x-3 group"
              >
                <Users className="w-4 h-4 text-purple-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-100 group-hover:text-purple-300">
                    b. Phone/Friend Picked Up
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Family or friend answered, patient unavailable. Follow-up scheduled for tomorrow.
                  </div>
                </div>
              </button>

              {/* Option C: Other Reason Toggle */}
              <button
                onClick={() => setSelectedOtherSubOption(selectedOtherSubOption === 'other' ? null : 'other')}
                className={`w-full p-3.5 bg-slate-950 hover:bg-purple-950/40 border rounded-xl text-left transition flex items-start space-x-3 group ${
                  selectedOtherSubOption === 'other'
                    ? 'border-purple-500 bg-purple-950/20'
                    : 'border-slate-800 hover:border-purple-500/50'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-purple-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-100 group-hover:text-purple-300">
                    c. Other Reason (Custom Note)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Specify custom unreachable or follow-up reason with free-text notes.
                  </div>
                </div>
              </button>
            </div>

            {/* If Option C is selected, reveal the text box and submit button */}
            {selectedOtherSubOption === 'other' && (
              <form onSubmit={handleSubmitOtherReason} className="mt-3 pt-3 border-t border-slate-800 space-y-3 animate-in fade-in">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Describe Reason / Note: <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={otherReasonCustomText}
                    onChange={(e) => setOtherReasonCustomText(e.target.value)}
                    placeholder="Enter details about why lead is unreachable or requested action..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOtherSubOption(null);
                      setOtherReasonCustomText('');
                    }}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!otherReasonCustomText.trim()}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition shadow"
                  >
                    Confirm & Save Reason
                  </button>
                </div>
              </form>
            )}

            {!selectedOtherSubOption && (
              <div className="flex justify-end mt-4 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOtherReasonModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remind Me Later Modal */}
      {currentLead && (
        <RemindMeLaterModal
          isOpen={remindModalOpen}
          onClose={() => setRemindModalOpen(false)}
          lead={currentLead}
          currentUser={currentUser}
          onReminderSet={(newReminder) => {
            setReminders((prev) => [newReminder, ...prev.filter((r) => r.lead_id !== newReminder.lead_id)]);
            setLeads((prev) =>
              prev.map((l) =>
                l.id === currentLead.id
                  ? {
                      ...l,
                      next_follow_up_date: new Date(newReminder.remind_at).toISOString().split('T')[0],
                      next_follow_up_time: new Date(newReminder.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }
                  : l
              )
            );
          }}
        />
      )}

      {/* Real-time Reminder Notification Banner */}
      <ReminderNotificationBanner
        currentUser={currentUser}
        onCallLead={(leadId) => {
          const idx = myQueue.findIndex((l) => l.id === leadId);
          if (idx !== -1) {
            setCurrentIndex(idx);
            persistQueuePosition(leadId, currentUser.id);
          }
        }}
      />

    </div>
  );
}
