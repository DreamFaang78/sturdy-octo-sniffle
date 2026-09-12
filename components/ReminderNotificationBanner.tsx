'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BellRing, 
  Phone, 
  Clock, 
  X, 
  ChevronRight, 
  Volume2, 
  CheckCircle2, 
  RotateCw,
  Sparkles
} from 'lucide-react';
import { CallReminder, Profile } from '@/lib/types';
import { 
  playReminderAlertChime, 
  sendBrowserNotification,
  requestNotificationPermission 
} from '@/lib/notifications';

interface ReminderNotificationBannerProps {
  currentUser?: Profile;
  onCallLead?: (leadId: string, leadPhone?: string) => void;
}

export default function ReminderNotificationBanner({
  currentUser,
  onCallLead,
}: ReminderNotificationBannerProps) {
  const router = useRouter();
  const [dueReminders, setDueReminders] = useState<CallReminder[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const checkDueReminders = async () => {
    try {
      const callerId = currentUser?.id || '';
      const url = `/api/reminders?dueOnly=true${callerId ? `&callerId=${encodeURIComponent(callerId)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const list: CallReminder[] = data.reminders || [];

      // Filter out reminders dismissed in current session
      const active = list.filter((r) => !dismissedIds.has(r.id));
      setDueReminders(active);

      // Trigger audio & push notification for newly discovered due items
      active.forEach((r) => {
        if (!notifiedIdsRef.current.has(r.id)) {
          notifiedIdsRef.current.add(r.id);
          playReminderAlertChime();
          sendBrowserNotification(
            `⏰ Scheduled Callback Due: ${r.lead_name || 'Patient'}`,
            `Phone: ${r.lead_phone || 'N/A'}${r.note ? ` | Note: ${r.note}` : ''}`
          );
        }
      });
    } catch (e) {
      console.warn('Error checking due reminders:', e);
    }
  };

  // Poll every 30 seconds
  useEffect(() => {
    checkDueReminders();
    const interval = setInterval(checkDueReminders, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id, dismissedIds]);

  const handleCallNow = async (reminder: CallReminder) => {
    setIsProcessing(reminder.id);
    try {
      // Mark reminder as completed
      await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reminder.id, status: 'completed' }),
      });

      setDismissedIds((prev) => new Set(prev).add(reminder.id));
      setDueReminders((prev) => prev.filter((r) => r.id !== reminder.id));

      if (onCallLead) {
        onCallLead(reminder.lead_id, reminder.lead_phone || undefined);
      } else {
        // Direct jump to dialer or lead page
        router.push(`/caller/dialer?leadId=${encodeURIComponent(reminder.lead_id)}`);
      }
    } catch (e) {
      console.error('Failed to trigger call for reminder:', e);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSnooze = async (reminderId: string, minutes: number) => {
    setIsProcessing(reminderId);
    try {
      await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reminderId, snoozeMinutes: minutes }),
      });

      setDismissedIds((prev) => new Set(prev).add(reminderId));
      setDueReminders((prev) => prev.filter((r) => r.id !== reminderId));
      setSnoozeMenuId(null);
    } catch (e) {
      console.error('Failed to snooze reminder:', e);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDismiss = async (reminderId: string) => {
    setIsProcessing(reminderId);
    try {
      await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reminderId, status: 'dismissed' }),
      });

      setDismissedIds((prev) => new Set(prev).add(reminderId));
      setDueReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch (e) {
      console.error('Failed to dismiss reminder:', e);
    } finally {
      setIsProcessing(null);
    }
  };

  if (dueReminders.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full space-y-3 pointer-events-auto animate-in slide-in-from-bottom-5 duration-300">
      {dueReminders.map((reminder) => {
        const isSnoozing = snoozeMenuId === reminder.id;
        const busy = isProcessing === reminder.id;

        return (
          <div
            key={reminder.id}
            className="bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl text-slate-100 relative overflow-hidden"
          >
            {/* Ambient Pulse Glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-teal-400 to-amber-500 animate-pulse" />

            <div className="flex items-start justify-between gap-3">
              
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 animate-bounce">
                  <BellRing className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
                      Scheduled Callback Due!
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-white mt-0.5">
                    {reminder.lead_name || 'Patient'}
                  </h3>

                  <div className="text-xs text-slate-300 font-mono flex items-center space-x-2 mt-0.5">
                    <span>{reminder.lead_phone}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-teal-400 font-medium">
                      Requested: {new Date(reminder.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {reminder.note && (
                    <div className="mt-1.5 p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-200/90 italic">
                      "{reminder.note}"
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDismiss(reminder.id)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
                title="Dismiss reminder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons Row */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              
              <div className="flex items-center space-x-1.5">
                {/* Snooze dropdown/buttons */}
                {isSnoozing ? (
                  <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 animate-in fade-in">
                    <button
                      onClick={() => handleSnooze(reminder.id, 15)}
                      disabled={busy}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg"
                    >
                      +15m
                    </button>
                    <button
                      onClick={() => handleSnooze(reminder.id, 30)}
                      disabled={busy}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg"
                    >
                      +30m
                    </button>
                    <button
                      onClick={() => handleSnooze(reminder.id, 60)}
                      disabled={busy}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg"
                    >
                      +1h
                    </button>
                    <button
                      onClick={() => setSnoozeMenuId(null)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSnoozeMenuId(reminder.id)}
                    disabled={busy}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition flex items-center space-x-1"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Snooze</span>
                  </button>
                )}

                <button
                  onClick={() => handleDismiss(reminder.id)}
                  disabled={busy}
                  className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-xl transition"
                >
                  Dismiss
                </button>
              </div>

              {/* GIANT CALL NOW BUTTON */}
              <button
                onClick={() => handleCallNow(reminder)}
                disabled={busy}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black rounded-xl transition shadow-lg flex items-center space-x-1.5 hover:scale-[1.02] active:scale-95 shrink-0"
              >
                <Phone className="w-4 h-4 fill-slate-950" />
                <span>CALL NOW</span>
              </button>

            </div>

          </div>
        );
      })}
    </div>
  );
}
